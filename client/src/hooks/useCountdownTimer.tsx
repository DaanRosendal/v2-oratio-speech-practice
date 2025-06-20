import { useState, useEffect, useRef, useCallback } from "react";
import {
  SpeechType,
  DEFAULT_TIMES,
  IS_DEV_MODE,
  IMPROMPTU_AND_EVALUATIVE_THRESHOLDS,
  PREPARED_THRESHOLDS,
} from "@/lib/constants";

export default function useCountdownTimer(
  speechType: SpeechType,
  onComplete?: () => void,
  initialMinutes?: number,
  initialSeconds?: number
) {
  // State for timer - use custom values if provided, otherwise use defaults
  const getInitialMinutes = () => {
    if (initialMinutes !== undefined) return initialMinutes;
    return DEFAULT_TIMES[speechType].minutes;
  };

  const getInitialSeconds = () => {
    if (initialSeconds !== undefined) return initialSeconds;
    return DEFAULT_TIMES[speechType].seconds;
  };

  const [minutes, setMinutes] = useState<number>(getInitialMinutes());
  const [seconds, setSeconds] = useState<number>(getInitialSeconds());
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [hideCountdown, setHideCountdown] = useState<boolean>(false);
  const [timeAlert, setTimeAlert] = useState<string | null>(null);
  const [timerColor, setTimerColor] = useState<string>(
    "hsl(var(--foreground))"
  );

  // Calculate total and remaining time
  const [totalTime, setTotalTime] = useState<number>(minutes * 60 + seconds);
  const [remainingTime, setRemainingTime] = useState<number>(
    minutes * 60 + seconds
  );
  const [progress, setProgress] = useState<number>(1);

  // Refs for interval and timeout
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const alertTimeout = useRef<NodeJS.Timeout | null>(null);

  // Get the appropriate color thresholds based on speech type and current timing
  const getColorThresholds = useCallback(() => {
    // Check if current time is different from default (custom timing)
    const defaultTime = DEFAULT_TIMES[speechType];
    const defaultTotalSeconds = defaultTime.minutes * 60 + defaultTime.seconds;
    const isCustomTiming = totalTime !== defaultTotalSeconds;

    if (isCustomTiming) {
      // Calculate dynamic thresholds: Green at 32%, Orange at 16%
      return {
        GREEN: Math.ceil(totalTime * 0.32),
        ORANGE: Math.ceil(totalTime * 0.16),
        RED: 0,
      };
    } else {
      // Use speech-type specific thresholds for default timings
      if (speechType === SpeechType.PREPARED) {
        return PREPARED_THRESHOLDS;
      } else {
        return IMPROMPTU_AND_EVALUATIVE_THRESHOLDS;
      }
    }
  }, [speechType, totalTime]);

  // Update total and remaining time when minutes/seconds change in settings
  useEffect(() => {
    if (!isRunning && !isPaused) {
      const total = minutes * 60 + seconds;
      setTotalTime(total);
      setRemainingTime(total);
      setProgress(1);
    }
  }, [minutes, seconds, isRunning, isPaused]);

  // Update timer default values when speech type changes
  useEffect(() => {
    if (!isRunning && !isPaused) {
      const defaultTime = DEFAULT_TIMES[speechType];
      const newMinutes =
        initialMinutes !== undefined ? initialMinutes : defaultTime.minutes;
      const newSeconds =
        initialSeconds !== undefined ? initialSeconds : defaultTime.seconds;
      setMinutes(newMinutes);
      setSeconds(newSeconds);
    }
  }, [speechType, initialMinutes, initialSeconds, isRunning, isPaused]);

  // Update hook state when initial values change (for custom timer persistence)
  useEffect(() => {
    if (!isRunning && !isPaused) {
      if (initialMinutes !== undefined) {
        setMinutes(initialMinutes);
      }
      if (initialSeconds !== undefined) {
        setSeconds(initialSeconds);
      }
    }
  }, [initialMinutes, initialSeconds, isRunning, isPaused]);

  // Update timer color based on remaining time
  useEffect(() => {
    const thresholds = getColorThresholds();
    let newColor;

    if (remainingTime <= thresholds.RED) {
      newColor = "#F44336"; // Red - time's up
    } else if (remainingTime <= thresholds.ORANGE) {
      newColor = "#F39C12"; // A vibrant, non-pastel orange
    } else if (remainingTime <= thresholds.GREEN) {
      newColor = "#4CAF50"; // Green
    } else {
      newColor = "hsl(var(--foreground))"; // Theme-aware default
    }

    // Only update if color actually changed
    if (newColor !== timerColor) {
      setTimerColor(newColor);
    }
  }, [remainingTime, timerColor, getColorThresholds]);

  // Update progress based on remaining time
  useEffect(() => {
    if (totalTime > 0) {
      setProgress(remainingTime / totalTime);
    } else {
      setProgress(1);
    }
  }, [remainingTime, totalTime]);

  // Clean up intervals and timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
      if (alertTimeout.current) clearTimeout(alertTimeout.current);
    };
  }, []);

  // Show time alert for a few seconds
  const showAlert = useCallback((message: string) => {
    setTimeAlert(message);

    if (alertTimeout.current) {
      clearTimeout(alertTimeout.current);
    }

    alertTimeout.current = setTimeout(() => {
      setTimeAlert(null);
    }, 3000);
  }, []);

  // Timer tick function for interval
  const timerTick = useCallback(() => {
    setRemainingTime((prevTime) => {
      // Handle timer completion
      if (prevTime <= 1) {
        if (timerInterval.current) {
          clearInterval(timerInterval.current);
          timerInterval.current = null;
        }

        setIsRunning(false);
        setIsPaused(false);
        showAlert("Time's up!");

        if (onComplete) {
          setTimeout(onComplete, 1000);
        }

        return 0;
      }

      // Calculate new remaining time
      const newRemainingTime = prevTime - 1;

      // Show alerts at specific times based on current mode
      const thresholds = getColorThresholds();

      // Check if we're using custom timing by comparing total time with default
      const defaultTime = DEFAULT_TIMES[speechType];
      const defaultTotalSeconds =
        defaultTime.minutes * 60 + defaultTime.seconds;
      const isCustomTiming = totalTime !== defaultTotalSeconds;

      if (isCustomTiming) {
        // Custom timing alerts with rounded seconds
        if (newRemainingTime === thresholds.GREEN) {
          const greenMinutes = Math.floor(thresholds.GREEN / 60);
          const greenSeconds = thresholds.GREEN % 60;
          if (greenMinutes > 0) {
            showAlert(
              `${greenMinutes} minute${greenMinutes > 1 ? "s" : ""} ${
                greenSeconds > 0 ? `${greenSeconds} seconds` : ""
              } remaining`.trim()
            );
          } else {
            showAlert(
              `${greenSeconds} second${greenSeconds > 1 ? "s" : ""} remaining`
            );
          }
        } else if (newRemainingTime === thresholds.ORANGE) {
          const orangeMinutes = Math.floor(thresholds.ORANGE / 60);
          const orangeSeconds = thresholds.ORANGE % 60;
          if (orangeMinutes > 0) {
            showAlert(
              `${orangeMinutes} minute${orangeMinutes > 1 ? "s" : ""} ${
                orangeSeconds > 0 ? `${orangeSeconds} seconds` : ""
              } remaining`.trim()
            );
          } else {
            showAlert(
              `${orangeSeconds} second${orangeSeconds > 1 ? "s" : ""} remaining`
            );
          }
        }
      } else {
        // Production mode alerts based on speech type
        if (speechType === SpeechType.PREPARED) {
          // Prepared speech alerts (2 minutes = green, 1 minute = orange)
          if (newRemainingTime === thresholds.GREEN) {
            showAlert("2 minutes remaining");
          } else if (newRemainingTime === thresholds.ORANGE) {
            showAlert("1 minute remaining");
          }
        } else {
          // Impromptu & Evaluative alerts (1 minute = green, 30 seconds = orange)
          if (newRemainingTime === thresholds.GREEN) {
            showAlert("1 minute remaining");
          } else if (newRemainingTime === thresholds.ORANGE) {
            showAlert("30 seconds remaining");
          }
        }
      }

      // Update minutes and seconds display
      setMinutes(Math.floor(newRemainingTime / 60));
      setSeconds(newRemainingTime % 60);

      return newRemainingTime;
    });
  }, [onComplete, showAlert, speechType, totalTime, getColorThresholds]);

  // Start the timer
  const startTimer = useCallback(() => {
    if (isRunning) return;

    // Calculate and set initial times
    const total = minutes * 60 + seconds;
    setTotalTime(total);
    setRemainingTime(total);
    setProgress(1);

    // Update timer state
    setIsRunning(true);
    setIsPaused(false);

    // Clear existing interval if any
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }

    // Start new interval
    timerInterval.current = setInterval(timerTick, 1000);

    // Log that timer started (for debugging)
    console.log("Timer started", { total });
  }, [minutes, seconds, isRunning, timerTick]);

  // Pause the timer
  const pauseTimer = useCallback(() => {
    if (!isRunning || isPaused) return;

    // Clear the interval
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }

    setIsPaused(true);
    console.log("Timer paused", { remainingTime });
  }, [isRunning, isPaused, remainingTime]);

  // Resume the timer after pause
  const resumeTimer = useCallback(() => {
    if (!isRunning || !isPaused) return;

    setIsPaused(false);

    // Clear any existing interval just in case
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }

    // Start new interval
    timerInterval.current = setInterval(timerTick, 1000);
    console.log("Timer resumed", { remainingTime });
  }, [isRunning, isPaused, timerTick, remainingTime]);

  // Reset the timer to initial values
  const resetTimer = useCallback(() => {
    // Clear the interval
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }

    // Get default times for current speech type
    const defaultTime = DEFAULT_TIMES[speechType];
    setMinutes(defaultTime.minutes);
    setSeconds(defaultTime.seconds);

    // Reset timer state
    const total = defaultTime.minutes * 60 + defaultTime.seconds;
    setTotalTime(total);
    setRemainingTime(total);
    setProgress(1);
    setTimerColor("hsl(var(--foreground))");

    // If timer was running, restart it
    if (isRunning) {
      setIsRunning(true);
      setIsPaused(false);
      timerInterval.current = setInterval(timerTick, 1000);
    }

    console.log("Timer reset", { total });
  }, [speechType, isRunning, timerTick]);

  // Stop the timer completely
  const stopTimer = useCallback(() => {
    // Clear the interval
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }

    // Reset timer state
    setIsRunning(false);
    setIsPaused(false);

    // Reset to default values for current speech type
    const defaultTime = DEFAULT_TIMES[speechType];
    setMinutes(defaultTime.minutes);
    setSeconds(defaultTime.seconds);

    const total = defaultTime.minutes * 60 + defaultTime.seconds;
    setTotalTime(total);
    setRemainingTime(total);
    setProgress(1);
    setTimerColor("hsl(var(--foreground))");

    console.log("Timer stopped");
  }, [speechType]);

  return {
    minutes,
    seconds,
    isRunning,
    isPaused,
    hideCountdown,
    timerColor,
    timeAlert,
    progress,
    setMinutes,
    setSeconds,
    setHideCountdown,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    stopTimer,
  };
}
