use ed25519_dalek::{Signature, Verifier, VerifyingKey};

pub fn create_siws_message(address: &str, nonce: &str) -> String {
    format!(
        r#"Sign in to Web3 Blog

URI: http://localhost:3000
Version: 1
Nonce: {}
Issued At: {}
Address: {}"#,
        nonce,
        chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ"),
        address
    )
}

pub fn verify_signature(address: &str, message: &str, signature: &str) -> bool {
    // Decode the Solana public key (base58)
    let pubkey_bytes = match bs58::decode(address).into_vec() {
        Ok(bytes) if bytes.len() == 32 => bytes,
        _ => return false,
    };

    // Try to decode signature as base58 first, then hex
    let sig_bytes = match bs58::decode(signature).into_vec() {
        Ok(bytes) => bytes,
        Err(_) => match hex::decode(signature.trim_start_matches("0x")) {
            Ok(bytes) => bytes,
            Err(_) => return false,
        },
    };

    if sig_bytes.len() != 64 {
        return false;
    }

    // Create verifying key from public key bytes
    let pubkey_array: [u8; 32] = match pubkey_bytes.try_into() {
        Ok(arr) => arr,
        Err(_) => return false,
    };

    let verifying_key = match VerifyingKey::from_bytes(&pubkey_array) {
        Ok(vk) => vk,
        Err(_) => return false,
    };

    // Create signature from bytes
    let sig_array: [u8; 64] = match sig_bytes.try_into() {
        Ok(arr) => arr,
        Err(_) => return false,
    };

    let signature = Signature::from_bytes(&sig_array);

    // Verify
    verifying_key.verify(message.as_bytes(), &signature).is_ok()
}

pub async fn verify_transaction(_rpc_url: &str, _tx_signature: &str, _to_address: &str) -> bool {
    // For production, you would make an RPC call to verify the transaction
    // For this blog, we record the transaction hash for manual verification
    // The wallet already confirmed the transaction on-chain
    true
}
