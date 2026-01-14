// Web3 Wallet Connection Module

window.connectedWallet = null;

// Admin addresses (lowercase for comparison)
const ADMIN_ADDRESSES = [
    '0x360091e9e692b7775543da956b7ca6cc39bae86c'
];

function isAdmin(address) {
    return ADMIN_ADDRESSES.includes(address.toLowerCase());
}

// Modal Functions
function openWalletModal() {
    const modal = document.getElementById('walletModal');
    const content = document.getElementById('walletModalContent');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeWalletModal() {
    const modal = document.getElementById('walletModal');
    const content = document.getElementById('walletModalContent');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 200);
}

// Wallet Dropdown Functions
function openWalletDropdown() {
    const dropdown = document.getElementById('walletDropdown');
    dropdown.classList.remove('hidden');
    updateNetworkChecks();
}

function closeWalletDropdown() {
    const dropdown = document.getElementById('walletDropdown');
    dropdown.classList.add('hidden');
}

function toggleWalletDropdown() {
    const dropdown = document.getElementById('walletDropdown');
    if (dropdown.classList.contains('hidden')) {
        openWalletDropdown();
    } else {
        closeWalletDropdown();
    }
}

function updateNetworkChecks() {
    // Hide all checks first
    document.getElementById('networkCheckEth')?.classList.add('hidden');
    document.getElementById('networkCheckAvax')?.classList.add('hidden');
    document.getElementById('networkCheckSol')?.classList.add('hidden');

    // Show check for current network
    if (window.connectedWallet) {
        const chain = window.connectedWallet.chain;
        if (chain === 'ethereum') {
            document.getElementById('networkCheckEth')?.classList.remove('hidden');
        } else if (chain === 'avalanche') {
            document.getElementById('networkCheckAvax')?.classList.remove('hidden');
        } else if (chain === 'solana') {
            document.getElementById('networkCheckSol')?.classList.remove('hidden');
        }
    }
}

async function switchNetwork(network) {
    if (!window.connectedWallet) return;

    // For EVM chains (Ethereum, Avalanche), we can switch networks in MetaMask
    if (network === 'ethereum' || network === 'avalanche') {
        if (typeof window.ethereum === 'undefined') {
            alert('Please install MetaMask');
            return;
        }

        const chainIds = {
            'ethereum': '0x1',      // Mainnet
            'avalanche': '0xa86a'   // Avalanche C-Chain
        };

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: chainIds[network] }]
            });

            // Update connected wallet chain
            window.connectedWallet.chain = network;
            localStorage.setItem('connectedWallet', JSON.stringify(window.connectedWallet));
            updateNetworkChecks();

            // Update button icon
            const btnText = document.getElementById('walletBtnText');
            if (btnText && window.connectedWallet.address) {
                const shortAddress = window.connectedWallet.address.substring(0, 6) + '...' + window.connectedWallet.address.substring(window.connectedWallet.address.length - 4);
                const icon = network === 'ethereum' ? '⟠' : '🔺';
                btnText.textContent = `${icon} ${shortAddress}`;
            }

        } catch (error) {
            // Chain not added, try to add it
            if (error.code === 4902 && network === 'avalanche') {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0xa86a',
                            chainName: 'Avalanche C-Chain',
                            nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
                            rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
                            blockExplorerUrls: ['https://snowtrace.io/']
                        }]
                    });
                    window.connectedWallet.chain = 'avalanche';
                    localStorage.setItem('connectedWallet', JSON.stringify(window.connectedWallet));
                    updateNetworkChecks();
                } catch (addError) {
                    console.error('Failed to add Avalanche network:', addError);
                }
            } else {
                console.error('Failed to switch network:', error);
            }
        }
    } else if (network === 'solana') {
        // For Solana, just update the UI - actual Phantom check happens at tip time
        window.connectedWallet.chain = 'solana';
        localStorage.setItem('connectedWallet', JSON.stringify(window.connectedWallet));
        updateNetworkChecks();

        // Update button icon to show Solana
        const btnText = document.getElementById('walletBtnText');
        if (btnText && window.connectedWallet.address) {
            const shortAddress = window.connectedWallet.address.substring(0, 6) + '...' + window.connectedWallet.address.substring(window.connectedWallet.address.length - 4);
            btnText.textContent = `◎ ${shortAddress}`;
        }
    }

    closeWalletDropdown();
}

// Ethereum (MetaMask) Connection
async function connectMetaMask() {
    if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask to connect with Ethereum!');
        window.open('https://metamask.io/download/', '_blank');
        return null;
    }

    try {
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });
        return accounts[0];
    } catch (error) {
        console.error('MetaMask connection error:', error);
        return null;
    }
}

// Solana (Phantom) Connection
async function connectPhantom() {
    if (typeof window.solana === 'undefined' || !window.solana.isPhantom) {
        alert('Please install Phantom wallet to connect with Solana!');
        window.open('https://phantom.app/', '_blank');
        return null;
    }

    try {
        const response = await window.solana.connect();
        return response.publicKey.toString();
    } catch (error) {
        console.error('Phantom connection error:', error);
        return null;
    }
}

// Sign Message with Ethereum
async function signMessageEth(message) {
    if (!window.ethereum) return null;

    try {
        const accounts = await window.ethereum.request({
            method: 'eth_accounts'
        });
        const signature = await window.ethereum.request({
            method: 'personal_sign',
            params: [message, accounts[0]]
        });
        return signature;
    } catch (error) {
        console.error('Signing error:', error);
        return null;
    }
}

// Sign Message with Solana
async function signMessageSol(message) {
    if (!window.solana) return null;

    try {
        const encodedMessage = new TextEncoder().encode(message);
        const signedMessage = await window.solana.signMessage(encodedMessage, 'utf8');
        // Convert to base58
        return btoa(String.fromCharCode.apply(null, signedMessage.signature));
    } catch (error) {
        console.error('Signing error:', error);
        return null;
    }
}

// Main Connect Function
async function connectWallet(chain, walletType) {
    const statusEl = document.getElementById('walletStatus');
    statusEl.classList.remove('hidden');

    let address = null;

    if (chain === 'ethereum' && walletType === 'metamask') {
        address = await connectMetaMask();
    } else if (chain === 'solana' && walletType === 'phantom') {
        address = await connectPhantom();
    }

    if (!address) {
        statusEl.innerHTML = '<span class="text-red-500">Connection failed. Please try again.</span>';
        setTimeout(() => statusEl.classList.add('hidden'), 3000);
        return;
    }

    // Get nonce from server
    try {
        const nonceResponse = await fetch('/api/auth/nonce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet_address: address,
                wallet_type: chain
            })
        });

        if (!nonceResponse.ok) throw new Error('Failed to get nonce');

        const { nonce, message } = await nonceResponse.json();

        // Sign the message
        statusEl.innerHTML = '<span class="text-primary-500">Please sign the message in your wallet...</span>';

        let signature = null;
        if (chain === 'ethereum') {
            signature = await signMessageEth(message);
        } else if (chain === 'solana') {
            signature = await signMessageSol(message);
        }

        if (!signature) {
            statusEl.innerHTML = '<span class="text-red-500">Signing cancelled or failed.</span>';
            setTimeout(() => statusEl.classList.add('hidden'), 3000);
            return;
        }

        // Verify signature with server
        const verifyResponse = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet_address: address,
                wallet_type: chain,
                signature: signature,
                message: message
            })
        });

        const verifyResult = await verifyResponse.json();

        if (verifyResult.success) {
            // Store connection info
            window.connectedWallet = {
                address: address,
                chain: chain,
                token: verifyResult.session_token
            };

            localStorage.setItem('connectedWallet', JSON.stringify(window.connectedWallet));

            // Update UI
            updateWalletUI(address, chain);
            closeWalletModal();
        } else {
            statusEl.innerHTML = '<span class="text-red-500">Authentication failed. Please try again.</span>';
        }
    } catch (error) {
        console.error('Authentication error:', error);
        statusEl.innerHTML = '<span class="text-red-500">Connection error. Please try again.</span>';
    }

    setTimeout(() => statusEl.classList.add('hidden'), 3000);
}

// Update UI after connection
function updateWalletUI(address, chain) {
    const btn = document.getElementById('connectWalletBtn');
    const btnText = document.getElementById('walletBtnText');
    const arrow = document.getElementById('walletDropdownArrow');
    const adminBadge = document.getElementById('adminBadge');

    const shortAddress = address.substring(0, 6) + '...' + address.substring(address.length - 4);
    const chainIcons = {
        'ethereum': '⟠',
        'avalanche': '🔺',
        'solana': '◎'
    };
    const chainIcon = chainIcons[chain] || '⟠';

    btnText.textContent = `${chainIcon} ${shortAddress}`;
    btn.onclick = toggleWalletDropdown;

    // Show dropdown arrow
    if (arrow) arrow.classList.remove('hidden');

    // Show admin badge if admin
    if (adminBadge) {
        if (isAdmin(address)) {
            adminBadge.classList.remove('hidden');
            window.isAdmin = true;
        } else {
            adminBadge.classList.add('hidden');
            window.isAdmin = false;
        }
    }

    // Dispatch event for other components
    window.dispatchEvent(new Event('walletConnected'));
}

// Disconnect wallet
function disconnectWallet() {
    window.connectedWallet = null;
    window.isAdmin = false;
    localStorage.removeItem('connectedWallet');

    const btn = document.getElementById('connectWalletBtn');
    const btnText = document.getElementById('walletBtnText');
    const arrow = document.getElementById('walletDropdownArrow');
    const adminBadge = document.getElementById('adminBadge');

    btnText.textContent = 'Connect';
    btn.onclick = openWalletModal;

    // Hide dropdown arrow
    if (arrow) arrow.classList.add('hidden');

    // Hide admin badge
    if (adminBadge) adminBadge.classList.add('hidden');

    // Close dropdown if open
    closeWalletDropdown();

    // Dispatch event for other components
    window.dispatchEvent(new Event('walletConnected'));
}

// Send crypto tip
async function sendCryptoTip(chain, recipient, amount) {
    if (chain === 'ethereum') {
        return await sendEthTip(recipient, amount);
    } else if (chain === 'solana') {
        return await sendSolTip(recipient, amount);
    }
    return null;
}

// Send ETH tip
async function sendEthTip(recipient, amount) {
    if (!window.ethereum) {
        throw new Error('Please install MetaMask');
    }

    const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
    });

    const weiAmount = '0x' + (parseFloat(amount) * 1e18).toString(16);

    const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
            from: accounts[0],
            to: recipient,
            value: weiAmount
        }]
    });

    return txHash;
}

// Send SOL tip
async function sendSolTip(recipient, amount) {
    if (!window.solana || !window.solana.isPhantom) {
        throw new Error('Please install Phantom wallet');
    }

    // Note: This requires @solana/web3.js to be loaded
    // For simplicity, we'll use a basic transfer
    // In production, you'd want to use the proper Solana SDK

    alert('Solana tipping requires additional setup. Please send SOL directly to: ' + recipient);
    return null;
}

// Check for existing connection on page load
document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('connectedWallet');
    if (saved) {
        try {
            window.connectedWallet = JSON.parse(saved);
            updateWalletUI(window.connectedWallet.address, window.connectedWallet.chain);
        } catch (e) {
            localStorage.removeItem('connectedWallet');
        }
    }
    // Dispatch event for initial state
    window.dispatchEvent(new Event('walletConnected'));
});

// Close modal on backdrop click
document.getElementById('walletModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'walletModal') {
        closeWalletModal();
    }
});

// Close wallet dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('walletDropdown');
    const btn = document.getElementById('connectWalletBtn');
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        closeWalletDropdown();
    }
});

// Listen for account changes (MetaMask)
if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            disconnectWallet();
        } else if (window.connectedWallet?.chain === 'ethereum') {
            window.connectedWallet.address = accounts[0];
            updateWalletUI(accounts[0], 'ethereum');
        }
    });
}

// Listen for disconnect (Phantom)
if (window.solana) {
    window.solana.on('disconnect', () => {
        if (window.connectedWallet?.chain === 'solana') {
            disconnectWallet();
        }
    });
}
