import React, { useEffect, useRef, useState } from "react";
import "./App.css";

const INITIAL_WORDS = [
  { word: "ab", definition: "Ability of different objects to respond to the same method call" },
  { word: "abc", definition: "Bundling data and methods that operate on the data" },
  { word: "abcd", definition: "Mechanism where a class derives from another class" }
];

function App() {
  /* ===== STATE ===== */
  const [words, setWords] = useState(INITIAL_WORDS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [fallSpeed, setFallSpeed] = useState(0.5);
  const [position, setPosition] = useState(0);

  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // Feedback state
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackClass, setFeedbackClass] = useState(""); // "" | "correct" | "incorrect"

  const [inputValue, setInputValue] = useState("");

  const definitionRef = useRef(null);
  const intervalRef = useRef(null);

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

  /* ===== FALLING LOOP ===== */
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setPosition(prev => {
        const next = prev + fallSpeed;

        if (definitionRef.current) {
          const bottom = definitionRef.current.getBoundingClientRect().bottom;
          if (bottom >= window.innerHeight - 60) {
            endGame();
          }
        }

        return next;
      });
    }, 16);

    return () => clearInterval(intervalRef.current);
  }, [fallSpeed, gameStarted, gameOver]);

  /* ===== GAME CONTROL ===== */
  function startGame() {
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setCurrentIndex(0);
    setFallSpeed(0.5);
    setPosition(0);
    setFeedbackText("");
    setFeedbackClass("");
    setInputValue("");
  }

  function endGame() {
    clearInterval(intervalRef.current);
    setGameOver(true);
  }

  function handleKeyDown(e) {
    if (e.key !== "Enter") return;

    const correct = words[currentIndex].word.toLowerCase();

    if (inputValue.toLowerCase() === correct) {
      setScore(s => s + 1);
      setFallSpeed(s => Math.min(s + 0.2, 5));
      setFeedbackText("Correct!");
      setFeedbackClass("correct");
    } else {
      setFeedbackText(`Incorrect! Answer: ${correct}`);
      setFeedbackClass("incorrect");
    }

    setInputValue("");
    setPosition(0);

    if (currentIndex + 1 < words.length) {
      setCurrentIndex(i => i + 1);
    } else {
      endGame();
    }
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
        startGame();
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
          <div id="game-area">
            <div
              id="definition"
              ref={definitionRef}
              className="definition-box"
              style={{ top: position }}
            >
              {words[currentIndex]?.definition}
            </div>
          </div>

          <input
            id="input"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />

          <div id="feedback" className={feedbackClass}>{feedbackText}</div>
          <div id="score">Score: {score}</div>
        </>
      )}

      {gameOver && (
        <div className="end-screen-overlay">
          <div className="end-screen">
            <h2>Game Over</h2>
            <p className="final-score">Final Score: {score}</p>
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
