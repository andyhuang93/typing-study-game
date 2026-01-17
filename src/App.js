import React, { useEffect, useRef, useState } from "react";
import "./App.css";

const INITIAL_WORDS = [
  { word: "ab", definition: "Ability of different objects to respond to the same method call" },
  { word: "abc", definition: "Bundling data and methods that operate on the data" },
  { word: "abcd", definition: "Mechanism where a class derives from another class" },
];

function App() {
  /* ===== STATE ===== */
  const [words, setWords] = useState(INITIAL_WORDS);
  const [shuffledWords, setShuffledWords] = useState([]);
  const [activeDefs, setActiveDefs] = useState([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [fallSpeed, setFallSpeed] = useState(0.5);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const [inputValue, setInputValue] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackClass, setFeedbackClass] = useState("");

  const nextWordIndex = useRef(0);
  const intervalRef = useRef(null);
  const alreadyMissedIds = useRef(new Set());

  /* ===== STARFIELD ===== */
  const canvasRef = useRef(null);
  const starsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    starsRef.current = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2,
      speed: 0.5 + Math.random() * 1.5
    }));

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "white";

      starsRef.current.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        star.y += star.speed;
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width;
        }
      });

      requestAnimationFrame(animate);
    }

    animate();
    return () => window.removeEventListener("resize", resize);
  }, []);

  /* ===== SPAWN DEFINITIONS FROM TOP RANDOMLY ===== */
  const spawnDefinition = React.useCallback(() => {
    if (nextWordIndex.current >= shuffledWords.length) return;

    const w = shuffledWords[nextWordIndex.current];

    // Make sure definitions don't go off-screen
    const boxWidth = Math.min(400, window.innerWidth - 20);
    const padding = boxWidth / 2;

    setActiveDefs(defs => [
      ...defs,
      {
        id: Date.now() + Math.random(),
        word: w.word,
        definition: w.definition,
        y: 0,
        speed: fallSpeed,
        x: Math.random() * (window.innerWidth - padding * 2) + padding
      }
    ]);

    nextWordIndex.current += 1;
  }, [shuffledWords, fallSpeed]);

  /* ===== FALLING LOOP ===== */
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    intervalRef.current = setInterval(() => {
      setActiveDefs(defs => {
        const defsToRemove = [];
        let updatedDefs = defs.map(d => ({ ...d, y: d.y + d.speed }));
        
        for (let d of updatedDefs) {
          // Check if definition reached bottom AND hasn't been counted yet
          if (d.y > window.innerHeight - 120 && !alreadyMissedIds.current.has(d.id)) {
            alreadyMissedIds.current.add(d.id);
            defsToRemove.push(d.id);
            
            setLives(prevLives => {
              const newLives = prevLives - 1;
              if (newLives <= 0) {
                endGame();
              }
              return newLives;
            });
          }
        }

        // Remove missed definitions immediately
        return updatedDefs.filter(d => !defsToRemove.includes(d.id));
      });
    }, 16);

    return () => clearInterval(intervalRef.current);
  }, [gameStarted, gameOver, fallSpeed]);

  /* ===== SPAWN TIMER (slower) ===== */
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    spawnDefinition();
    const spawnTimer = setInterval(spawnDefinition, 7500);

    return () => clearInterval(spawnTimer);
  }, [gameStarted, gameOver, spawnDefinition]);

  /* ===== GAME CONTROL ===== */
  function startGame() {
    // Shuffle the words array
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setShuffledWords(shuffled);
    
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setLives(3);
    setFallSpeed(0.5);
    setActiveDefs([]);
    nextWordIndex.current = 0;
    alreadyMissedIds.current = new Set();
    setInputValue("");
    setFeedbackText("");
    setFeedbackClass("");
  }

  function endGame() {
    clearInterval(intervalRef.current);
    setGameOver(true);
  }

  function handleKeyDown(e) {
    if (e.key !== "Enter") return;

    const typed = inputValue.toLowerCase();
    const match = activeDefs.find(d => d.word.toLowerCase() === typed);

    if (match) {
      setActiveDefs(defs => {
        const newDefs = defs.filter(d => d.id !== match.id);

        // Check if all words have been answered
        if (nextWordIndex.current >= shuffledWords.length && newDefs.length === 0) {
          endGame();
        }

        return newDefs;
      });

      setScore(s => s + 1);
      setFallSpeed(s => Math.min(s + 0.2, 5));
      setFeedbackText("Correct!");
      setFeedbackClass("correct");
    } else {
      setFeedbackText("Incorrect!");
      setFeedbackClass("incorrect");
    }

    setInputValue("");
  }

  /* ===== FILE UPLOAD ===== */
  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      const newWords = ev.target.result
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean)
        .map(line => {
          const [word, ...def] = line.split(":");
          return { word: word.trim(), definition: def.join(":").trim() };
        });

      if (newWords.length) {
        setWords(newWords);
      }
    };
    reader.readAsText(file);
  }

  /* ===== RENDER ===== */
  return (
    <>
      <canvas id="starfield" ref={canvasRef} />

      {!gameStarted && (
        <>
          <h1>Typing Study Game</h1>
          <button id="startBtn" onClick={startGame}>Start Game</button>
          <input type="file" id="fileInput" accept=".txt" onChange={handleFile} />
        </>
      )}

      {gameStarted && !gameOver && (
        <>
          {activeDefs
            .filter(d => d.y <= window.innerHeight - 120)
            .map(d => (
              <div
                key={d.id}
                className="definition-box"
                style={{
                  position: "fixed",
                  top: d.y,
                  left: d.x,
                  transform: "translateX(-50%)"
                }}
              >
                {d.definition}
              </div>
            ))}

          <input
            id="input"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type the word and press Enter"
            autoFocus
          />

          <div id="feedback" className={feedbackClass}>{feedbackText}</div>
          
          <div id="score">Score: {score}</div>
          
          <div style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(220px)",
            fontSize: "1.5em",
            textShadow: "1px 1px 3px #000",
            color: "red"
          }}>
            Lives: {"❤️".repeat(lives)}
          </div>
        </>
      )}

      {gameOver && (
        <div className="end-screen-overlay">
          <div className="end-screen">
            <h2>Game Over</h2>
            <p className="final-score">Final Score: {score}/{words.length}</p>
            <button id="restartBtn" onClick={startGame}>Restart Game</button>
            <div className="file-section">
              <p>Want to study a different word list?</p>
              <input type="file" accept=".txt" onChange={handleFile} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;