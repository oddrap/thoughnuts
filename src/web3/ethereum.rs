use ethers::{
    providers::{Http, Middleware, Provider},
    types::{Address, Signature, H256},
};
use siwe::Message;
use std::str::FromStr;

pub fn create_siwe_message(address: &str, nonce: &str) -> String {
    format!(
        r#"Sign in to Web3 Blog

URI: http://localhost:3000
Version: 1
Chain ID: 1
Nonce: {}
Issued At: {}
Address: {}"#,
        nonce,
        chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ"),
        address
    )
}

pub async fn verify_signature(address: &str, message: &str, signature: &str) -> bool {
    let sig_bytes = match hex::decode(signature.trim_start_matches("0x")) {
        Ok(bytes) => bytes,
        Err(_) => return false,
    };

    if sig_bytes.len() != 65 {
        return false;
    }

    let signature = match Signature::try_from(sig_bytes.as_slice()) {
        Ok(sig) => sig,
        Err(_) => return false,
    };

    let message_hash = ethers::utils::hash_message(message);

    match signature.recover(message_hash) {
        Ok(recovered) => {
            let expected = match Address::from_str(address) {
                Ok(addr) => addr,
                Err(_) => return false,
            };
            recovered == expected
        }
        Err(_) => false,
    }
}

pub async fn verify_transaction(rpc_url: &str, tx_hash: &str, to_address: &str) -> bool {
    let provider = match Provider::<Http>::try_from(rpc_url) {
        Ok(p) => p,
        Err(_) => return false,
    };

    let tx_hash = match H256::from_str(tx_hash.trim_start_matches("0x")) {
        Ok(h) => h,
        Err(_) => return false,
    };

    let expected_to = match Address::from_str(to_address) {
        Ok(a) => a,
        Err(_) => return false,
    };

    match provider.get_transaction(tx_hash).await {
        Ok(Some(tx)) => {
            if let Some(to) = tx.to {
                to == expected_to
            } else {
                false
            }
        }
        _ => false,
    }
}

pub async fn get_eth_balance(rpc_url: &str, address: &str) -> Option<String> {
    let provider = Provider::<Http>::try_from(rpc_url).ok()?;
    let address = Address::from_str(address).ok()?;
    let balance = provider.get_balance(address, None).await.ok()?;
    Some(ethers::utils::format_ether(balance))
}
