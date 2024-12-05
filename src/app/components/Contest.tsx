import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, ArrowUp } from "lucide-react";
import axios from "axios";
import { getISOWeekNumber } from "../utils/utils";

interface LeaderboardEntry {
  userId: number;
  username: string;
  points: number;
  rank?: number;
  user: { name: string };
}

const ContestBoard = ({ user }: any) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState({
    weekNumber: getISOWeekNumber(new Date()),
    year: new Date().getFullYear(),
  });

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      // This is a mock API - you'd need to implement this endpoint
      const response = await axios("/api/contest", {
        data: { type: "get leaderboard", userId: user.id },
        method: "POST",
      });

      console.log(response);

      if (response.status != 200) {
        throw new Error("Failed to fetch leaderboard");
      }

      const data = await response.data;
      setLeaderboard(data.weeklyScore);
      setLoading(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      setLoading(false);
    }
  };

  const renderLeaderboardIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="text-yellow-500 w-6 h-6 mr-2" />;
      case 2:
        return <Medal className="text-silver-500 w-6 h-6 mr-2" />;
      case 3:
        return <Medal className="text-bronze-500 w-6 h-6 mr-2" />;
      default:
        return <ArrowUp className="text-gray-500 w-6 h-6 mr-2" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-md mx-auto mt-10 border-red-500">
        <CardHeader className="bg-red-50">
          <CardTitle className="text-red-700">Error</CardTitle>
        </CardHeader>
        <CardContent className="text-red-600">{error}</CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto p-2 max-w-2xl">
      <Card className="shadow-lg">
        <CardHeader className="bg-gradient-to-r from-green-500 to-blue-600 text-white">
          <div className="  justify-between items-center">
            <CardTitle className="text-2xl font-bold">
              Weekly Leaderboard
            </CardTitle>
            <Badge variant="secondary" className="text-sm min-w-fit">
              Week {currentWeek.weekNumber} / {currentWeek.year}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          {leaderboard.length > 0 ? (
            leaderboard?.map((entry, index) => (
              <div
                key={entry.userId}
                className={`flex items-center justify-between p-4 rounded-lg mb-2 ${
                  index === 0
                    ? "bg-yellow-50"
                    : index === 1
                    ? "bg-gray-50"
                    : index === 2
                    ? "bg-orange-50"
                    : "bg-blue-50"
                }`}
              >
                <div className="flex items-center">
                  {renderLeaderboardIcon(index + 1)}
                  <span className="font-semibold text-gray-800">
                    {entry.user.name}
                  </span>
                </div>
                <div className="flex items-center min-w-fit">
                  <span className="text-lg font-bold text-green-700 mr-2">
                    {entry.points} pts
                  </span>
                  <Badge variant="outline" className="text-sm">
                    #{index + 1}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <div>No data</div>
          )}
        </CardContent>
      </Card>
      <div className="mt-4 text-sm text-gray-600 text-center">
        Top performers get special rewards! Keep challenging yourself.
      </div>
    </div>
  );
};

export default ContestBoard;