use std::env;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub blog_title: String,
    pub blog_description: String,
    pub author_eth_address: String,
    pub author_sol_address: String,
    pub author_btc_address: String,
    pub eth_rpc_url: String,
    pub sol_rpc_url: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite:blog.db?mode=rwc".to_string()),
            blog_title: env::var("BLOG_TITLE").unwrap_or_else(|_| "My Web3 Blog".to_string()),
            blog_description: env::var("BLOG_DESCRIPTION")
                .unwrap_or_else(|_| "A decentralized blog with crypto tipping".to_string()),
            author_eth_address: env::var("AUTHOR_ETH_ADDRESS").unwrap_or_default(),
            author_sol_address: env::var("AUTHOR_SOL_ADDRESS").unwrap_or_default(),
            author_btc_address: env::var("AUTHOR_BTC_ADDRESS").unwrap_or_default(),
            eth_rpc_url: env::var("ETH_RPC_URL")
                .unwrap_or_else(|_| "https://eth.llamarpc.com".to_string()),
            sol_rpc_url: env::var("SOL_RPC_URL")
                .unwrap_or_else(|_| "https://api.mainnet-beta.solana.com".to_string()),
        }
    }
}
