"use client";
import { GoHome } from "react-icons/go";
import { MdOutlineLeaderboard } from "react-icons/md";
import { useEffect, useState } from "react";
import LeaderBoard from "./components/LeaderBoard";
import { Game } from "./components/Game";
import axios, { AxiosResponse } from "axios";
import WebApp from "@twa-dev/sdk";
import UserProfile from "./components/Profile";
import ContestBoard from "./components/Contest";
import { WheelOfFortune } from "./components/Wheel";
import { useNearDeposits } from "./contracts/near_deposits";
import { useMultiplierContract } from "./hooks/useDepositContract";
import { useTonAddress } from "@tonconnect/ui-react";
import { useTonConnect } from "./hooks/useTonConnect";
import { useWallet } from "./contexts/WalletContext";
import { WelcomeModal } from "./components/WelcomeModal";

function Home() {
  const [selectedTab, setSelectedTab]: any = useState();
  const [tg, setTg] = useState<typeof WebApp | null>(null);
  const [user, setUser]: any = useState();
  const [leader, setLeader]: any = useState();
  const [loading, setLoading] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);
  const [curPage, setCurPage]: any = useState();
  const [userTasks, setUserTasks]: any = useState();
  const [tasks, setTasks]: any = useState();
  const [tasksCat, setTasksCat]: any = useState();

  const {
    state: { selector, accountId: nearAddress, isConnected: nearConnected },
  } = useWallet();

  const address = useTonAddress();
  const { deposits } = useMultiplierContract(address);

  const {
    deposits: nearDeposits,
    loading: nearLoading,
    refetch,
  } = useNearDeposits();

  const getDeposits = (): number => {
    let total = 0;
    if (!nearDeposits?.deposits) return total;

    const ONE_WEEK_IN_SECONDS = 604800;

    const isDepositActive = (startTimeInMs: number) => {
      const startTimeInSeconds = startTimeInMs / 1000; // Convert ms to seconds
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      const endTimeInSeconds = startTimeInSeconds + ONE_WEEK_IN_SECONDS;

      // Return true only if current time is less than end time
      return currentTimeInSeconds <= endTimeInSeconds;
    };

    Object.values(nearDeposits.deposits).map((deposit) => {
      const startTimeInMs = Number(deposit.startTime) / 1000000; // Convert to milliseconds

      if (isDepositActive(startTimeInMs))
        total += Number(deposit.multiplier) / 1e16;
    });
    return total;
  };

  useEffect(() => {
    if (selectedTab) {
      const _tg = window?.Telegram?.WebApp;
      if (_tg) {
        setTg(_tg);
        getUser();
        getLeaderBoard();
      }
    } else setSelectedTab("Home");
  }, [selectedTab]);

  // useEffect(() => {
  //   switch (selectedTab) {
  //     case "Leaderboard":
  //       if (!leader) return;
  //       setCurPage(<LeaderBoard leader={leader} user={user} />);
  //       break;
  //     case "Game":
  //       setCurPage(<Game userDetails={user} claimPoints={claimPoints} />);
  //       break;
  //     case "Contest":
  //       setCurPage(<ContestBoard user={user} />);
  //       break;
  //     case "Wheel":
  //       setCurPage(<WheelOfFortune />);
  //       break;
  //     default:
  //       setCurPage(
  //         <UserProfile
  //           tasks={tasks}
  //           userTasks={userTasks}
  //           userDetails={user}
  //           getAllInfo={getAllInfo}
  //           claimPoints={claimPoints}
  //         />
  //       );
  //       break;
  //   }
  // }, [selectedTab, leader, userTasks, tg, user, tasksCat]);

  useEffect(() => {
    if (!nearAddress || user?.username) return;
    getUser();
  }, [nearAddress]);

  useEffect(() => {
    if (!nearConnected || !user) return;
    if (user?.wallet) return;

    const updateWallet = async () => {
      const res = await axios("/api/allroute", {
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
        data: JSON.stringify({
          username: user.username,
          wallet: nearAddress,
          type: "updateWallet",
        }),
      });
      console.log(res);
    };
    updateWallet();
  }, [nearConnected, user]);

  const getUser = async () => {
    const user = getUserData();

    try {
      let res: AxiosResponse;
      const username = user?.username;
      if (username) {
        res = await axios("/api/allroute?type=getUser&username=" + username);
      } else if (nearAddress) {
        res = await axios(
          "/api/allroute?type=getUserByWallet&wallet=" + nearAddress
        );
      } else {
        console.error("No username or wallet available");
        setLoadingPage(false);
        return;
      }

      if (res.status === 200 && res.data) {
        setUser(res.data);
        getTasks();
        getAllUserTasks(res.data);

        const expiryTime = Date.now() + 15 * 24 * 60 * 60 * 1000; // 15 days in milliseconds
        const data = {
          userData: res.data,
          expiryTime,
        };
        localStorage.setItem("userSession", JSON.stringify(data));
      } else {
        console.error("Failed to get user:", res.status, res.data);
        setLoadingPage(false);
      }
    } catch (error: any) {
      if (error?.response?.status === 404) {
        // User doesn't exist, we could handle new user registration here
        console.log("User not found - new user flow needed");
        setLoadingPage(false);
        alert("User not found - new user flow needed");
      } else {
        alert(error);
        setLoadingPage(false);
        console.error(
          "Error fetching user:",
          error?.response?.data || error.message
        );
      }
    }
  };

  const getUserData = () => {
    const storedData = localStorage.getItem("userSession");
    if (storedData) {
      const { userData, expiryTime } = JSON.parse(storedData);
      if (Date.now() < expiryTime) {
        return userData; // Still valid
      } else {
        localStorage.removeItem("userSession"); // Expired
      }
    }
    return null;
  };

  const getLeaderBoard = async () => {
    try {
      const res = await axios("/api/allroute?type=leaderboard");
      if (res.status === 200) {
        setLeader(res.data);
      } else {
        console.error("Failed to get leaderboard:", res.status, res.data);
      }
    } catch (error: any) {
      console.error(
        "Error fetching leaderboard:",
        error?.response?.data || error.message
      );
    }
  };

  const getAllInfo = async () => {
    await getUser();
    await getLeaderBoard();
    await getTasks();
  };

  const getTasks = async () => {
    try {
      const res = await axios(
        "/api/allroute?type=getTasksInfo&username=" + user?.username
      );

      if (res.status == 200) {
        setTasks(res.data);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const getAllUserTasks = async (data: any) => {
    try {
      if (!data?.id) {
        console.error("User ID is required for fetching tasks");
        setUserTasks([]); // Set empty tasks instead of null
        return;
      }

      const res = await axios.get(
        `/api/allroute?type=allusertasks&id=${data.id}`
      );
      if (res.status === 200) {
        setUserTasks(res.data);
      } else {
        console.error("Failed to get user tasks:", res.status, res.data);
        setUserTasks([]); // Set empty tasks instead of null
      }
    } catch (error: any) {
      console.error(
        "Error fetching user tasks:",
        error?.response?.data || error.message
      );
      setUserTasks([]); // Set empty tasks instead of null
    }
  };

  useEffect(() => {
    if (tasks && !tasks.error && user?.username) {
      setLoadingPage(false);
    }
  }, [tasks]);

  useEffect(() => {
    if (!tg) return;

    const initializeApp = async () => {
      try {
        await getAllInfo();
      } catch (error) {
        console.error("Error initializing app:", error);
        setLoadingPage(false);
      }
    };

    initializeApp();
  }, [tg]);

  const claimPoints = async (
    type: string,
    func: (param: boolean) => object
  ) => {
    console.log(type);
    setLoading(true);

    let total = 0;
    if (nearDeposits?.deposits) {
      total = getDeposits();
    } else if (deposits?.length > 0) {
      for (let index = 0; index < deposits?.length; index++) {
        total += Number(deposits[index].multiplier);
      }
    }

    const res = await (
      await fetch("/api/claim", {
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          username: user?.username,
          type,
          userMultipler: total,
        }),
      })
    ).json();

    console.log(res);

    if (res.username != null) {
      setLoading(false);
      getUser();
      getLeaderBoard();
      func(false);
    }
    setLoading(false);
  };

  const handlePageChange = (page: string) => {
    setSelectedTab(page);
  };

  return (
    <div className="min-h-screen bg-[#0B0B14]">
      {loadingPage ? (
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div>
          {user ? (
            <div className="max-w-[430px] no-scrollbar mx-auto relative min-h-screen">
              <div className="flex flex-col no-scrollbar h-screen">
                <div className="flex-1 overflow-y-auto no-scrollbar pb-20 h-[90vh]">
                  {selectedTab === "Home" && (
                    <UserProfile
                      userDetails={user}
                      tasks={tasks}
                      tg={tg}
                      getAllInfo={getAllInfo}
                      userTasks={userTasks}
                      claimPoints={claimPoints}
                    />
                  )}
                  {selectedTab === "Contest" && <ContestBoard user={user} />}
                  {selectedTab === "Wheel" && (
                    <WheelOfFortune user={user} claimPoints={claimPoints} />
                  )}
                  {selectedTab === "Game" && (
                    <Game userDetails={user} claimPoints={claimPoints} />
                  )}
                  {selectedTab === "Leaderboard" && (
                    <LeaderBoard leader={leader} user={user} />
                  )}
                </div>

                <div className="fixed bottom-0 left-0 right-0 bg-[#151524] border-t border-[#2A2A45] shadow-glow-blue">
                  <div className="max-w-[430px] mx-auto">
                    <div className="flex justify-around items-center px-4 py-2">
                      <button
                        onClick={() => handlePageChange("Home")}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
                          selectedTab === "Home"
                            ? "text-[#4C6FFF] bg-[#1A1A2F] shadow-glow-sm"
                            : "text-[#8E8EA8] hover:text-[#4C6FFF] hover:bg-[#1A1A2F]/50"
                        }`}
                      >
                        <GoHome className="text-2xl mb-1" />
                        <span className="text-xs">Profile</span>
                      </button>

                      {/* <button
                  onClick={() => handlePageChange("Contest")}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
                    selectedTab === "Contest"
                      ? "text-[#4C6FFF] bg-[#1A1A2F] shadow-glow-sm"
                      : "text-[#8E8EA8] hover:text-[#4C6FFF] hover:bg-[#1A1A2F]/50"
                  }`}
                >
                  <svg
                    className="w-6 h-6 mb-1"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 15L8.5 12L12 9L15.5 12L12 15Z"
                      fill="currentColor"
                    />
                    <path
                      d="M3 9L12 3L21 9V15L12 21L3 15V9Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-xs">Contest</span>
                </button> */}

                      <button
                        onClick={() => handlePageChange("Wheel")}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
                          selectedTab === "Wheel"
                            ? "text-[#4C6FFF] bg-[#1A1A2F] shadow-glow-sm"
                            : "text-[#8E8EA8] hover:text-[#4C6FFF] hover:bg-[#1A1A2F]/50"
                        }`}
                      >
                        <svg
                          className="w-6 h-6 mb-1"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="9"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                          <path
                            d="M12 3V12L17 15"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="text-xs">Wheel</span>
                      </button>

                      <button
                        onClick={() => handlePageChange("Game")}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
                          selectedTab === "Game"
                            ? "text-[#4C6FFF] bg-[#1A1A2F] shadow-glow-sm"
                            : "text-[#8E8EA8] hover:text-[#4C6FFF] hover:bg-[#1A1A2F]/50"
                        }`}
                      >
                        <svg
                          className="w-6 h-6 mb-1"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M6 11H10M8 9V13"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <circle cx="15" cy="11" r="1" fill="currentColor" />
                          <circle cx="18" cy="13" r="1" fill="currentColor" />
                          <path
                            d="M3 7C3 4.79086 4.79086 3 7 3H17C19.2091 3 21 4.79086 21 7V17C21 19.2091 19.2091 21 17 21H7C4.79086 21 3 19.2091 3 17V7Z"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                        </svg>
                        <span className="text-xs">Game</span>
                      </button>

                      <button
                        onClick={() => handlePageChange("Leaderboard")}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
                          selectedTab === "Leaderboard"
                            ? "text-[#4C6FFF] bg-[#1A1A2F] shadow-glow-sm"
                            : "text-[#8E8EA8] hover:text-[#4C6FFF] hover:bg-[#1A1A2F]/50"
                        }`}
                      >
                        <MdOutlineLeaderboard className="text-2xl mb-1" />
                        <span className="text-xs">Ranks</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <WelcomeModal setUser={setUser} />
          )}
        </div>
      )}
    </div>
  );
}

export default Home;
