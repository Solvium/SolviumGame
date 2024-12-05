import React, { useState, useEffect } from "react";

const TimerCountdown = ({ time }: { time: number }) => {
  const startDate = new Date(time);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = new Date().getTime();
      const endTime = startDate.getTime();
      const remaining = endTime - currentTime;

      if (remaining <= 0) {
        clearInterval(interval);
        setTimeRemaining(0);
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startDate]);

  const hours = Math.floor((timeRemaining / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((timeRemaining / (1000 * 60)) % 60);
  const seconds = Math.floor((timeRemaining / 1000) % 60);

  return (
    <div className="ml-2">
      <h1 className="text-[10px] font-bold">
        {hours.toString().padStart(2, "0")}:
        {minutes.toString().padStart(2, "0")}:
        {seconds.toString().padStart(2, "0")}
      </h1>
    </div>
  );
};

export default TimerCountdown;