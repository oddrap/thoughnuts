# Web3 Blog

A modern, decentralized blog built with Rust featuring wallet authentication and crypto tipping on both Ethereum and Solana.

## Features

- **Wallet Authentication**: Sign in with MetaMask (Ethereum) or Phantom (Solana)
- **Crypto Tipping**: Support creators directly with ETH or SOL
- **Beautiful UI**: Modern design with TailwindCSS and dark mode support
- **Markdown Blog**: Write posts in Markdown with syntax highlighting
- **Cost Effective**: SQLite database, minimal hosting requirements

## Tech Stack

- **Backend**: Rust + Axum
- **Templates**: Askama
- **Styling**: TailwindCSS (CDN)
- **Database**: SQLite
- **Ethereum**: ethers-rs + SIWE
- **Solana**: solana-sdk

## Prerequisites

- [Rust](https://rustup.rs/) (1.70+)
- SQLite3

## Quick Start

1. **Install Rust** (if not already installed):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source $HOME/.cargo/env
   ```

2. **Clone and setup**:
   ```bash
   cd vibe_p_one
   cp .env.example .env
   ```

3. **Configure your wallet addresses** in `.env`:
   ```env
   AUTHOR_ETH_ADDRESS=your_ethereum_address
   AUTHOR_SOL_ADDRESS=your_solana_address
   ```

4. **Run the server**:
   ```bash
   cargo run
   ```

5. **Open your browser**: http://localhost:3000

## Project Structure

```
vibe_p_one/
├── src/
│   ├── main.rs              # Server entry point
│   ├── config.rs            # Configuration
│   ├── routes/              # API routes
│   ├── handlers/            # Request handlers
│   ├── models/              # Data models
│   ├── web3/                # Ethereum & Solana integration
│   ├── markdown/            # Markdown parser
│   └── db/                  # Database operations
├── templates/               # Askama HTML templates
├── static/                  # CSS and JavaScript
├── posts/                   # Markdown blog posts
└── migrations/              # SQLite migrations
```

## Writing Blog Posts

Create a new markdown file in the `posts/` directory:

```markdown
---
title: My First Post
description: A brief description of the post
author: Your Name
tags:
  - rust
  - web3
published: true
---

# Your content here

Write your blog post using Markdown...
```

Posts are automatically loaded when the server starts.

## Web3 Configuration

### Ethereum (MetaMask)

1. Users connect with MetaMask
2. SIWE (Sign-In with Ethereum) for authentication
3. ETH tipping to your configured address

### Solana (Phantom)

1. Users connect with Phantom wallet
2. SIWS (Sign-In with Solana) for authentication
3. SOL tipping to your configured address

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database path | `sqlite:blog.db?mode=rwc` |
| `BLOG_TITLE` | Blog title | `My Web3 Blog` |
| `BLOG_DESCRIPTION` | Blog description | `A decentralized blog...` |
| `AUTHOR_ETH_ADDRESS` | Your Ethereum address for tips | - |
| `AUTHOR_SOL_ADDRESS` | Your Solana address for tips | - |
| `ETH_RPC_URL` | Ethereum RPC endpoint | `https://eth.llamarpc.com` |
| `SOL_RPC_URL` | Solana RPC endpoint | `https://api.mainnet-beta.solana.com` |

## Deployment

The blog is designed to be cost-effective:

- **Free tier options**: Fly.io, Railway, Render
- **VPS**: Any $5/month VPS (DigitalOcean, Vultr, etc.)
- **Database**: SQLite is embedded, no external DB needed

### Production Build

```bash
cargo build --release
./target/release/vibe_p_one
```

## License

MIT
