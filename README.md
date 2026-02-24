
# Kaleido SuperNode LaunchPad

## Overview
Kaleido SuperNode LaunchPad is a full-stack web application that enables users to mint exclusive NFT nodes and participate in premium point mining on the Abstract blockchain. The platform consists of a React + Vite frontend and a Node.js/Express backend, with MySQL for persistent storage. Users can mint NFTs, manage their assets, and mine points using customizable server resources. The project is designed for scalability, security, and seamless blockchain integration.

## Features
- **NFT Minting:** Mint Kaleido SuperNode NFTs on the Abstract Chain (free mint, max 10 per wallet).
- **Premium Mining:** NFT holders can mine premium points in real-time, selecting custom CPU and RAM allocations.
- **Admin Dashboard:** Admins can authenticate, manage withdrawals, and monitor platform activity.
- **NFT Gallery:** View all minted NFTs and user-owned assets.
- **2FA Security:** Optional two-factor authentication for admin actions.
- **Webhook Support:** Register webhooks for mining notifications and integrations.
- **Responsive UI:** Modern, mobile-friendly interface built with Tailwind CSS and shadcn/ui components.

## Architecture
- **Frontend:** React (Vite), TypeScript, RainbowKit, Wagmi, ethers.js, shadcn/ui
- **Backend:** Node.js, Express, TypeScript, MySQL, PM2 for process management
- **Blockchain:** Abstract Chain (EVM-compatible), NFT smart contract

## Folder Structure
```
KaleidoLabs/
	├── src/                # Frontend source code
	├── server/             # Backend server code
	├── public/             # Static assets
	├── .env.example        # Example environment variables
	├── package.json        # Frontend dependencies
	└── ...
```

## Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- MySQL server

## Setup Instructions

### 1. Clone the Repository
```bash
git clone <repo-url>
cd KaleidoLabs
```

### 2. Configure Environment Variables
- Copy `.env.example` to `.env` and fill in all required values for both backend and frontend.
- For backend, place the `.env` file in the `server/` directory.

### 3. Install Dependencies
#### Frontend:
```bash
npm install
# or
yarn install
```
#### Backend:
```bash
cd server
npm install
# or
yarn install
```

### 4. Initialize the Database
Edit your MySQL credentials in `.env` and run the provided SQL scripts:
```bash
mysql -u <user> -p < server/init-db.sql
mysql -u <user> -p < server/db/schema.sql
mysql -u <user> -p < server/db/nft_schema.sql
```

### 5. Build and Run the Backend
```bash
cd server
npm run build
npm start
# Or use PM2 for production:
npm run deploy
```

### 6. Run the Frontend
```bash
npm run dev
# or
yarn dev
```

## Deployment
- Use the provided `server/deploy.sh` script for production deployment (installs dependencies, builds, and starts with PM2).
- Configure a reverse proxy (e.g., Nginx) to route frontend and backend traffic as needed.

## Environment Variables
See `.env.example` for all required variables. Key variables include:
- `PORT`, `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `JWT_SECRET`
- `NFT_CONTRACT_ADDRESS`, `RPC_URL`, `CHAIN_ID`, `EXTERNAL_API_KEY`, `WEBHOOK_SECRET`, `ABSTRACT_RPC_URL`
- Frontend: `VITE_API_URL` (if connecting to a remote backend)

## Usage
- Connect your wallet (RainbowKit, MetaMask, etc.)
- Mint up to 10 Kaleido SuperNode NFTs per wallet
- Access the Premium Mining page to start mining points
- Admins can log in for advanced controls and withdrawals

## Security Notes
- Never commit your real `.env` file or secrets to version control.
- Use strong, unique secrets for JWT and API keys.

## License
MIT

---
For questions or support, open an issue or contact the maintainers.
