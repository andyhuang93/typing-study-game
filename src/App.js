import React, { useEffect, useRef, useState } from "react";
import "./App.css";

const INITIAL_WORDS = [
  { word: "cat", definition: "meow" },
  { word: "dog", definition: "woof" },
  { word: "sheep", definition: "mAA" },
];

const GAME_MODES = {
  CLASSIC: "classic",
  CLASSIC_HARD: "classic_hard",
  TIMED: "timed",
};

function App() {
  const [words, setWords] = useState(INITIAL_WORDS);
  const [shuffledWords, setShuffledWords] = useState([]);
  const [activeDefs, setActiveDefs] = useState([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [fallSpeed, setFallSpeed] = useState(0.5);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameMode, setGameMode] = useState(GAME_MODES.CLASSIC);
  const [timeLeft, setTimeLeft] = useState(180);
  const [inputValue, setInputValue] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackClass, setFeedbackClass] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const nextWordIndex = useRef(0);
  const intervalRef = useRef(null);
  const alreadyMissedIds = useRef(new Set());
  const lastAnswerTime = useRef(0);
  const lastSpawnTime = useRef(0);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);
  const starsRef = useRef([]);
  const speedIncreaseIntervalRef = useRef(null);
  const spawnLoopRef = useRef(null);
  const isPausedRef = useRef(false);

  const SPAWN_COOLDOWN_MS = 500;
  const MIN_SPAWN_MS = 5000;
  const MAX_SPAWN_MS = 8000;
  const MIN_SPAWN_MS_HARD = 2500;
  const MAX_SPAWN_MS_HARD = 4500;

  // Hard mode speed settings
  const INITIAL_SPEED = 0.45;
  const SPEED_INCREASE_AMOUNT = 0.15;
  const SPEED_INCREASE_INTERVAL = 5000;
  const MAX_SPEED = 2.3;

  /* -------------------- STARFIELD -------------------- */
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
      speed: 0.5 + Math.random() * 1.5,
    }));

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "white";
      starsRef.current.forEach((star) => {
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

  /* -------------------- PAUSE ON TAB CHANGE -------------------- */
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        setIsPaused(true);
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  /* -------------------- PAUSE / QUIT CONFIRM WITH ESC -------------------- */
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key !== "Escape") return;
      if (!gameStarted || gameOver) return;

      if (showQuitConfirm) {
        setShowQuitConfirm(false);
        setIsPaused(false);
        lastAnswerTime.current = Date.now();
        return;
      }

      setIsPaused((prev) => {
        const next = !prev;
        if (!next) lastAnswerTime.current = Date.now();
        return next;
      });
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameStarted, gameOver, showQuitConfirm]);

  /* -------------------- HARD MODE SPEED INCREASE -------------------- */
  useEffect(() => {
    if (!gameStarted || gameOver || isPaused || gameMode !== GAME_MODES.CLASSIC_HARD)
      return;

    speedIncreaseIntervalRef.current = setInterval(() => {
      setFallSpeed((prev) => Math.min(prev + SPEED_INCREASE_AMOUNT, MAX_SPEED));
    }, SPEED_INCREASE_INTERVAL);

    return () => clearInterval(speedIncreaseIntervalRef.current);
  }, [gameStarted, gameOver, isPaused, gameMode]);

  useEffect(() => {
    if (gameMode === GAME_MODES.CLASSIC_HARD && gameStarted && !gameOver) {
      setActiveDefs((defs) => defs.map((d) => ({ ...d, speed: fallSpeed })));
    }
  }, [fallSpeed, gameMode, gameStarted, gameOver]);

  /* -------------------- SPAWN DEFINITION -------------------- */
  const spawnDefinition = React.useCallback(() => {
    const now = Date.now();
    if (now - lastAnswerTime.current < SPAWN_COOLDOWN_MS) return;

    const minSpawn =
      gameMode === GAME_MODES.CLASSIC_HARD ? MIN_SPAWN_MS_HARD : MIN_SPAWN_MS;
    if (now - lastSpawnTime.current < minSpawn) return;

    if (
      (gameMode === GAME_MODES.CLASSIC || gameMode === GAME_MODES.CLASSIC_HARD) &&
      nextWordIndex.current >= shuffledWords.length
    )
      return;

    const w = shuffledWords[nextWordIndex.current % shuffledWords.length];
    if (!w) return;

    const boxWidth = Math.min(400, window.innerWidth - 20);
    const padding = boxWidth / 2;

    setActiveDefs((defs) => [
      ...defs,
      {
        id: Date.now() + Math.random(),
        word: w.word,
        definition: w.definition,
        y: 0,
        speed: fallSpeed,
        x: Math.random() * (window.innerWidth - padding * 2) + padding,
      },
    ]);

    lastSpawnTime.current = now;
    nextWordIndex.current += 1;
  }, [shuffledWords, fallSpeed, gameMode]);

  /* -------------------- FALLING LOOP -------------------- */
  useEffect(() => {
    if (!gameStarted || gameOver || isPaused) return;

    intervalRef.current = setInterval(() => {
      setActiveDefs((defs) => {
        const removeIds = [];
        const updated = defs.map((d) => ({ ...d, y: d.y + d.speed }));

        for (let d of updated) {
          if (d.y > window.innerHeight - 120) {
            if (!alreadyMissedIds.current.has(d.id)) {
              alreadyMissedIds.current.add(d.id);

              if (
                gameMode === GAME_MODES.CLASSIC ||
                gameMode === GAME_MODES.CLASSIC_HARD
              ) {
                setLives((prev) => {
                  const next = prev - 1;
                  if (next <= 0) endGame();
                  return next;
                });
              }
            }
            removeIds.push(d.id);
          }
        }

        const newDefs = updated.filter((d) => !removeIds.includes(d.id));

        // Only end game if lives run out
        if (
          (gameMode === GAME_MODES.CLASSIC || gameMode === GAME_MODES.CLASSIC_HARD) &&
          lives <= 0
        ) {
          endGame();
        }

        return newDefs;
      });
    }, 16);

    return () => clearInterval(intervalRef.current);
  }, [gameStarted, gameOver, gameMode, isPaused, shuffledWords.length, lives]);

  /* -------------------- CHECK GAME COMPLETION -------------------- */
  useEffect(() => {
    if (!gameStarted || gameOver || gameMode === GAME_MODES.TIMED) return;
    
    if (nextWordIndex.current >= shuffledWords.length && activeDefs.length === 0) {
      endGame();
    }
  }, [activeDefs.length, gameStarted, gameOver, gameMode, shuffledWords.length]);

  /* -------------------- SPAWN LOOP -------------------- */
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const startSpawnLoop = React.useCallback(() => {
    const loop = () => {
      if (!gameStarted || gameOver) return;
      if (!isPausedRef.current) spawnDefinition();

      const minSpawn =
        gameMode === GAME_MODES.CLASSIC_HARD ? MIN_SPAWN_MS_HARD : MIN_SPAWN_MS;
      const maxSpawn =
        gameMode === GAME_MODES.CLASSIC_HARD ? MAX_SPAWN_MS_HARD : MAX_SPAWN_MS;
      const nextTime = Math.random() * (maxSpawn - minSpawn) + minSpawn;
      spawnLoopRef.current = setTimeout(loop, nextTime);
    };
    loop();
  }, [gameStarted, gameOver, spawnDefinition, gameMode]);

  useEffect(() => {
    if (!gameStarted || gameOver) return;
    startSpawnLoop();
    return () => clearTimeout(spawnLoopRef.current);
  }, [gameStarted, gameOver, startSpawnLoop]);

  /* -------------------- TIMED MODE -------------------- */
  useEffect(() => {
    if (!gameStarted || gameOver || isPaused || gameMode !== GAME_MODES.TIMED) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          endGame();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [gameStarted, gameOver, gameMode, isPaused]);

  /* -------------------- AUTO CLEAR FEEDBACK -------------------- */
  useEffect(() => {
    if (!feedbackText) return;

    setIsFading(false);

    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 4500); // start fade slightly before removal

    const clearTimer = setTimeout(() => {
      setFeedbackText("");
      setFeedbackClass("");
      setIsFading(false);
    }, 5000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(clearTimer);
    };
  }, [feedbackText]);


  /* -------------------- GAME CONTROL -------------------- */
  function startGame() {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setShuffledWords(shuffled);
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setLives(3);
    setActiveDefs([]);
    setTimeLeft(180);
    setIsPaused(false);
    setShowQuitConfirm(false);
    setFallSpeed(gameMode === GAME_MODES.CLASSIC_HARD ? INITIAL_SPEED : 0.5);
    nextWordIndex.current = 0;
    alreadyMissedIds.current = new Set();
    lastSpawnTime.current = 0;
    setInputValue("");
    setFeedbackText("");
    setFeedbackClass("");
  }

  function endGame() {
    clearInterval(intervalRef.current);
    clearInterval(timerRef.current);
    clearTimeout(spawnLoopRef.current);
    clearInterval(speedIncreaseIntervalRef.current);
    setGameOver(true);
  }

  function goToMainMenu() {
    setGameStarted(false);
    setGameOver(false);
    setActiveDefs([]);
    setInputValue("");
    setFeedbackText("");
    setFeedbackClass("");
    setIsPaused(false);
    setShowQuitConfirm(false);
    clearTimeout(spawnLoopRef.current);
    clearInterval(speedIncreaseIntervalRef.current);
  }

  function handleKeyDown(e) {
    if (e.key !== "Enter" || isPaused) return;

    const typed = inputValue.toLowerCase();
    const match = activeDefs.find((d) => d.word.toLowerCase() === typed);

    if (match) {
      lastAnswerTime.current = Date.now();

      setActiveDefs((defs) => {
        const newDefs = defs.filter((d) => d.id !== match.id);
        return newDefs;
      });

      setScore((s) => s + 1);
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
    reader.onload = (ev) => {
      const newWords = ev.target.result
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const [word, ...def] = line.split(":");
          return { word: word.trim(), definition: def.join(":").trim() };
        });

      if (newWords.length) setWords(newWords);
    };
    reader.readAsText(file);
  }

  /* -------------------- RENDER -------------------- */
  return (
    <>
      <canvas id="starfield" ref={canvasRef} />

      {!gameStarted && (
        <>
          <h1>Typing Study Game</h1>
          <select
            id="modeSelect"
            value={gameMode}
            onChange={(e) => setGameMode(e.target.value)}
          >
            <option value={GAME_MODES.CLASSIC}>Classic</option>
            <option value={GAME_MODES.CLASSIC_HARD}>Classic: Hard Mode</option>
            <option value={GAME_MODES.TIMED}>Timed (3 minutes)</option>
          </select>
          <button id="startBtn" onClick={startGame}>
            Start Game
          </button>
          <input type="file" id="fileInput" accept=".txt" onChange={handleFile} />
        </>
      )}

      {gameStarted && !gameOver && (
        <>
          <button
            className="quit-btn"
            onClick={() => {
              setIsPaused(true);
              setShowQuitConfirm(true);
            }}
          >
            ❌
          </button>

          {activeDefs
            .filter((d) => d.y <= window.innerHeight - 120)
            .map((d) => (
              <div
                key={d.id}
                className="definition-box"
                style={{
                  position: "fixed",
                  top: d.y,
                  left: d.x,
                  transform: "translateX(-50%)",
                }}
              >
                {d.definition}
              </div>
            ))}

          <input
            id="input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type the word and press Enter"
            autoFocus
          />

          <div 
          id="feedback" 
          className={`${feedbackClass} ${isFading ? "fade-out" : ""}`}
          >
            {feedbackText}
          </div>
          <div id="score">Score: {score}</div>

          {gameMode === GAME_MODES.TIMED && (
            <div
              style={{
                position: "absolute",
                bottom: "25px",
                left: "50%",
                transform: "translateX(220px)",
                fontSize: "1.75em",
                textShadow: "1px 1px 3px #000",
                color: "red",
              }}
            >
              Time: {Math.floor(timeLeft / 60)}:
              {String(timeLeft % 60).padStart(2, "0")}
            </div>
          )}

          {(gameMode === GAME_MODES.CLASSIC ||
            gameMode === GAME_MODES.CLASSIC_HARD) && (
            <div
              style={{
                position: "absolute",
                bottom: "25px",
                left: "50%",
                transform: "translateX(220px)",
                fontSize: "1.75em",
                textShadow: "1px 1px 3px #000",
                color: "red",
              }}
            >
              Lives: {"❤️".repeat(lives)}
            </div>
          )}
        </>
      )}

      {isPaused && gameStarted && !gameOver && !showQuitConfirm && (
        <div
          className="pause-overlay"
          onClick={() => {
            setIsPaused(false);
            lastAnswerTime.current = Date.now();
          }}
        >
          <div className="pause-box">
            <h2>PAUSED</h2>
            <p>Click anywhere or press Escape to resume</p>
          </div>
        </div>
      )}

      {showQuitConfirm && gameStarted && !gameOver && (
        <div
          className="quit-confirm-overlay"
          onClick={() => {
            setShowQuitConfirm(false);
            setIsPaused(false);
          }}
        >
          <div className="quit-confirm-box" onClick={(e) => e.stopPropagation()}>
            <h3>Are you sure?</h3>
            <p>Quitting will return to main menu.</p>
            <div className="confirm-buttons">
              <button
                className="confirm-yes"
                onClick={() => {
                  setShowQuitConfirm(false);
                  goToMainMenu();
                }}
              >
                Yes
              </button>
              <button
                className="confirm-no"
                onClick={() => {
                  setShowQuitConfirm(false);
                  setIsPaused(false);
                }}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="end-screen-overlay">
          <div className="end-screen">
            <h2>Game Over</h2>
            <p className="final-score">
              Final Score: {score}
              {(gameMode === GAME_MODES.CLASSIC ||
                gameMode === GAME_MODES.CLASSIC_HARD) &&
                ` / ${words.length}`}
            </p>
            <button id="restartBtn" onClick={startGame}>
              Restart Game
            </button>
            <button id="mainMenuBtn" onClick={goToMainMenu}>
              Back to Main Menu
            </button>
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