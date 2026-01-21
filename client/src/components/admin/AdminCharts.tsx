import React, { useState, useEffect } from "react";
import styles from "./AdminCharts.module.css";

interface ChartData {
  label: string;
  value: number;
  percentage: number;
}

interface AdminChartsProps {
  compact?: boolean;
}

const AdminCharts: React.FC<AdminChartsProps> = ({ compact = false }) => {
  const [transactionData, setTransactionData] = useState<ChartData[]>([
    { label: "Jan", value: 12000, percentage: 60 },
    { label: "Feb", value: 15000, percentage: 75 },
    { label: "Mar", value: 18000, percentage: 90 },
    { label: "Apr", value: 22000, percentage: 100 },
    { label: "May", value: 19000, percentage: 85 },
    { label: "Jun", value: 25000, percentage: 95 },
  ]);

  const [userActivity, setUserActivity] = useState<ChartData[]>([
    { label: "Mon", value: 240, percentage: 48 },
    { label: "Tue", value: 300, percentage: 60 },
    { label: "Wed", value: 290, percentage: 58 },
    { label: "Thu", value: 350, percentage: 70 },
    { label: "Fri", value: 400, percentage: 80 },
    { label: "Sat", value: 360, percentage: 72 },
    { label: "Sun", value: 310, percentage: 62 },
  ]);

  const [gameStats, setGameStats] = useState([
    { name: "Chess", count: 345, color: "#3b82f6" },
    { name: "Poker", count: 287, color: "#8b5cf6" },
    { name: "Ludo", count: 156, color: "#10b981" },
    { name: "Other", count: 89, color: "#f59e0b" },
  ]);

  const totalGames = gameStats.reduce((sum, game) => sum + game.count, 0);

  const SimpleBarChart: React.FC<{ data: ChartData[]; title: string }> = ({
    data,
    title,
  }) => (
    <div className={styles.chartContainer}>
      <h3>{title}</h3>
      <div className={styles.barChart}>
        {data.map((item, idx) => (
          <div key={idx} className={styles.barItem}>
            <div className={styles.bar}>
              <div
                className={styles.barFill}
                style={{ height: `${item.percentage}%` }}
              />
            </div>
            <span className={styles.label}>{item.label}</span>
            <span className={styles.value}>{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const PieChart: React.FC<{ title: string }> = ({ title }) => {
    const slices = gameStats.map((game) => {
      const percentage = (game.count / totalGames) * 100;
      return {
        ...game,
        percentage,
        startAngle: gameStats.slice(0, gameStats.indexOf(game)).reduce((sum, g) => sum + (g.count / totalGames) * 360, 0),
      };
    });

    return (
      <div className={styles.chartContainer}>
        <h3>{title}</h3>
        <div className={styles.pieChartWrapper}>
          <div className={styles.pieChart}>
            {slices.map((slice, idx) => (
              <div
                key={idx}
                className={styles.pieSector}
                style={{
                  background: slice.color,
                  "--angle": `${slice.startAngle}deg`,
                  "--size": `${slice.percentage}%`,
                } as any}
                title={`${slice.name}: ${slice.count} (${slice.percentage.toFixed(1)}%)`}
              />
            ))}
          </div>
          <div className={styles.pieLegend}>
            {gameStats.map((game, idx) => (
              <div key={idx} className={styles.legendItem}>
                <span
                  className={styles.colorDot}
                  style={{ backgroundColor: game.color }}
                />
                <span className={styles.legendLabel}>
                  {game.name}
                  <span className={styles.legendValue}>
                    {game.count} ({((game.count / totalGames) * 100).toFixed(0)}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ""}`}>
      <div className={styles.header}>
        <h2>📊 Analytics Dashboard</h2>
      </div>

      <div className={styles.chartsGrid}>
        <SimpleBarChart data={transactionData} title="💰 Transaction Volume (6 Months)" />
        <SimpleBarChart data={userActivity} title="👥 User Activity (Weekly)" />
        <PieChart title="🎮 Games Distribution" />
      </div>
    </div>
  );
};

export default AdminCharts;
