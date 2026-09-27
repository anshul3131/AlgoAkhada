# CP-MatchMaker Project Context & Architecture

This document serves as the central reference for the architecture and workflows of the **CP-MatchMaker** platform. It outlines the tech stack, the main components, and the step-by-step flow for each core feature. 

**Note**: *Whenever new features are added, modified, or removed, this document must be updated to keep the project context accurate.*

---

## 🛠 Tech Stack Overview

### Frontend
- **Framework**: React with Vite
- **Styling**: Tailwind CSS
- **Code Editor**: Monaco Editor (`@monaco-editor/react`)
- **Real-time Communication**: Socket.IO client
- **Data Visualization**: Recharts (for the Dashboard)

### Backend
- **Server**: Node.js & Express (TypeScript)
- **Database**: PostgreSQL (via TypeORM)
- **Caching & Pub/Sub**: Redis
- **Message Broker**: Kafka (`kafkajs`) - Used for queuing and distributing code execution jobs safely.
- **Real-time Server**: Socket.IO
- **Code Execution**: Isolated Docker Containers (Python & C++ Runners) reading from Kafka/Redis and reporting results.
- **Problem Scraping**: Puppeteer (headless browser automation)

---

## 🔄 Core Workflows

### 1. 2-Player Matchmaking Flow
The core competitive experience of the platform.
- **Entry**: From the main Lobby (Home Screen), users can click "Find Match" to enter the Queue. They can optionally queue up for specific topics (tags).
- **Matchmaking (Queue)**: The frontend sends a Socket event (`join_queue`) to the backend. The backend's matchmaking engine pairs two users with similar Elo ratings (and matching tags, if specified).
- **Battleground**: Once a match is found, both players are transitioned to the `Battleground` screen. They are presented with the same coding problem. They write code in the Monaco Editor and submit it.
- **Code Execution**: Submissions are sent via API/Socket, pushed to Kafka/Redis, and picked up by the isolated Code Runner Docker containers. Results are streamed back in real-time.
- **Aftermath**: The first player to get an "Accepted" verdict wins. The match ends, and both players are routed to the `AftermathScreen`, where their Elo ratings are updated. They are given options to return to the Lobby or Rematch.

### 2. Custom Lobby Flow
Allows groups of friends to play against each other privately.
- **Creation/Joining**: A user can create a Custom Lobby from the home screen, generating a unique Lobby Code. Other users can join using this code or by accepting real-time invites.
- **Staging Area (The Custom Arena)**: A rich 3-column dashboard where users wait before the match starts:
  - **Left Column**: Displays match rules, topic, and host controls (Start Match, Edit Rules, Invite).
  - **Center Column (Chat Arena)**: An interactive text-chat interface where users can send messages and emojis (`emoji-picker-react`) via Socket.IO.
  - **Right Column (Voice Chat & Squad)**: Displays the list of participants with live status. Integrated WebRTC enables full-mesh, peer-to-peer Voice Chat with global Mute/Deafen controls directly within the browser.
- **Custom Battleground**: The host configures and starts the match. All players are pulled into the `CustomBattleground`. 
- **Match Conclusion**: The flow behaves similarly to regular matches, but multiple players can submit. Upon match end, a custom aftermath/leaderboard is shown for the lobby, and users can exit back to the lobby staging area for another round.

### 3. Topic-Based Upsolving Flow
Allows users to practice and solve specific problems outside of a competitive environment.
- **Entry**: Users can select a problem they previously missed, or pick one from the Tag Explorer.
- **Practice Screen**: The user is routed to the `PracticeScreen` in "upsolve" mode.
- **Execution**: They can write code, run against sample test cases, and submit for final evaluation without the pressure of a timer or an opponent. Results do not affect their Elo rating.

### 4. Tag Explorer Flow
Allows users to browse and discover problems based on specific algorithms and data structures.
- **Interface**: The `TagExplorerScreen` displays various tags (e.g., Arrays, Dynamic Programming, Graphs).
- **Actions**: Users can filter problems by tag. From here, they have two main choices:
  - **Queue by Tag**: Enter the competitive matchmaking queue specifically for problems with the selected tag.
  - **Practice (Upsolve)**: Directly open a problem from the tag list into the Practice screen to solve it at their own pace.

### 5. Dashboard Flow
A comprehensive view of a user's competitive profile and statistics.
- **Interface**: The `DashboardScreen` visualizes the user's progress using Recharts.
- **Data Points**: Includes the user's current Elo rating, rating history (plotted on a graph), total matches played, win/loss ratio, and strongest/weakest topics based on past performances.

### 6. Recently Played / Recent Solutions Component
Provides quick access to a user's recent activity directly from the Home Screen.
- **Lobby Integration**: The main `LobbyDashboard` features a component detailing the user's recent matches and submissions.
- **Solution Review**: By clicking on a recent submission, the user is navigated to the `RecentSolutionScreen` (`solution-review` mode) where they can view the exact code they submitted, the test cases it passed/failed, and analyze their performance.
