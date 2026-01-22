import React, { useEffect, useRef, useState } from "react";
import "./App.css";

const INITIAL_WORDS = [
  { word: "ab", definition: "Ability of different objects to respond to the same method call" },
  { word: "abc", definition: "Bundling data and methods that operate on the data" },
  { word: "abcd", definition: "Mechanism where a class derives from another class" },
];

const GAME_MODES = {
  CLASSIC: "classic",
  TIMED: "timed",
};

function App() {
  const [words, setWords] = useState(INITIAL_WORDS);
  const [shuffledWords, setShuffledWords] = useState([]);
  const [activeDefs, setActiveDefs] = useState([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [fallSpeed] = useState(0.5);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const [gameMode, setGameMode] = useState(GAME_MODES.CLASSIC);
  const [timeLeft, setTimeLeft] = useState(180);

  const [inputValue, setInputValue] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackClass, setFeedbackClass] = useState("");

  const nextWordIndex = useRef(0);
  const intervalRef = useRef(null);
  const alreadyMissedIds = useRef(new Set());
  const lastAnswerTime = useRef(0);
  const timerRef = useRef(null);

  const SPAWN_COOLDOWN_MS = 500;

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

  const spawnDefinition = React.useCallback(() => {
    const now = Date.now();
    if (now - lastAnswerTime.current < SPAWN_COOLDOWN_MS) return;

    if (gameMode === GAME_MODES.CLASSIC && nextWordIndex.current >= shuffledWords.length) return;

    const w = shuffledWords[nextWordIndex.current % shuffledWords.length];
    if (!w) return;

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
  }, [shuffledWords, fallSpeed, gameMode]);

  useEffect(() => {
    if (!gameStarted || gameOver) return;

    intervalRef.current = setInterval(() => {
      setActiveDefs(defs => {
        const removeIds = [];
        const updated = defs.map(d => ({ ...d, y: d.y + d.speed }));

        for (let d of updated) {
          if (d.y > window.innerHeight - 120 && !alreadyMissedIds.current.has(d.id)) {
            alreadyMissedIds.current.add(d.id);
            removeIds.push(d.id);

            if (gameMode === GAME_MODES.CLASSIC) {
              setLives(prev => {
                const next = prev - 1;
                if (next <= 0) endGame();
                return next;
              });
            }
          }
        }

        return updated.filter(d => !removeIds.includes(d.id));
      });
    }, 16);

    return () => clearInterval(intervalRef.current);
  }, [gameStarted, gameOver, gameMode]);

  useEffect(() => {
    if (!gameStarted || gameOver) return;
    spawnDefinition();
    const spawnTimer = setInterval(spawnDefinition, 5000);
    return () => clearInterval(spawnTimer);
  }, [gameStarted, gameOver, spawnDefinition]);

  useEffect(() => {
    if (!gameStarted || gameOver || gameMode !== GAME_MODES.TIMED) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          endGame();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [gameStarted, gameOver, gameMode]);

  function startGame() {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setShuffledWords(shuffled);

    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setLives(3);
    setActiveDefs([]);
    setTimeLeft(180);

    nextWordIndex.current = 0;
    alreadyMissedIds.current = new Set();
    setInputValue("");
    setFeedbackText("");
    setFeedbackClass("");
  }

  function endGame() {
    clearInterval(intervalRef.current);
    clearInterval(timerRef.current);
    setGameOver(true);
  }

  function handleKeyDown(e) {
    if (e.key !== "Enter") return;

    const typed = inputValue.toLowerCase();
    const match = activeDefs.find(d => d.word.toLowerCase() === typed);

    if (match) {
      lastAnswerTime.current = Date.now();

      setActiveDefs(defs => {
        const newDefs = defs.filter(d => d.id !== match.id);

        if (
          gameMode === GAME_MODES.CLASSIC &&
          nextWordIndex.current >= shuffledWords.length &&
          newDefs.length === 0
        ) {
          endGame();
        }

        return newDefs;
      });

      setScore(s => s + 1);
      setFeedbackText("Correct!");
      setFeedbackClass("correct");
    } else {
      setFeedbackText("Incorrect!");
      setFeedbackClass("incorrect");
    }

    setInputValue("");
  }

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

      if (newWords.length) setWords(newWords);
    };
    reader.readAsText(file);
  }

  return (
    <>
      <canvas id="starfield" ref={canvasRef} />

      {!gameStarted && (
        <>
          <h1>Typing Study Game</h1>

          <select
            id="modeSelect"
            value={gameMode}
            onChange={e => setGameMode(e.target.value)}
          >
            <option value={GAME_MODES.CLASSIC}>Classic</option>
            <option value={GAME_MODES.TIMED}>Timed (3 minutes)</option>
          </select>

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

          {gameMode === GAME_MODES.TIMED && (
            <div style={{
              position: "absolute",
              bottom: "25px",
              left: "50%",
              transform: "translateX(220px)",
              fontSize: "1.75em",
              textShadow: "1px 1px 3px #000",
              color: "red"
            }}>
              Time: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </div>
          )}

          {gameMode === GAME_MODES.CLASSIC && (
            <div style={{
              position: "absolute",
              bottom: "25px",
              left: "50%",
              transform: "translateX(220px)",
              fontSize: "1.75em",
              textShadow: "1px 1px 3px #000",
              color: "red"
            }}>
              Lives: {"❤️".repeat(lives)}
            </div>
          )}
        </>
      )}

      {gameOver && (
        <div className="end-screen-overlay">
          <div className="end-screen">
            <h2>Game Over</h2>
            <p className="final-score">
              Final Score: {score}{gameMode === GAME_MODES.CLASSIC && ` / ${words.length}`}
            </p>
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
