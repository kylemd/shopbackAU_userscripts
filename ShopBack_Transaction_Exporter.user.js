// ==UserScript==
// @name         ShopBack Transaction Exporter
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Export all ShopBack transaction data (cashback in, cashback out, and order history)
// @author       kylemd
// @match        https://www.shopback.com.au/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=shopback.com.au
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Create and add the export button
    function addExportButton() {
        // Remove existing button if it exists
        const existingButton = document.getElementById('sb-export-button');
        if (existingButton) {
            existingButton.remove();
        }

        // Create button container (will be fixed position)
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'sb-export-button-container';
        buttonContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 2147483647; /* Maximum z-index value */
            pointer-events: auto;
        `;

        // Create button
        const exportButton = document.createElement('button');
        exportButton.id = 'sb-export-button';
        exportButton.textContent = 'Export Transaction Data';
        exportButton.style.cssText = `
            background-color: #e74c3c;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 10px 15px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;

        // Add hover effect
        exportButton.addEventListener('mouseover', () => {
            exportButton.style.backgroundColor = '#c0392b';
        });
        exportButton.addEventListener('mouseout', () => {
            exportButton.style.backgroundColor = '#e74c3c';
        });

        // Add click event
        exportButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startExport();
            return false;
        });

        // Add button to container
        buttonContainer.appendChild(exportButton);

        // Add container to document
        document.documentElement.appendChild(buttonContainer);
        console.log('ShopBack Export button added to page');
    }

    // Create status display
    function createStatusDisplay() {
        // Check if status display already exists
        if (document.getElementById('sb-export-status')) {
            return document.getElementById('sb-export-status');
        }

        // Create status display container
        const statusContainer = document.createElement('div');
        statusContainer.id = 'sb-export-status-container';
        statusContainer.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            z-index: 2147483646; /* One less than the button */
            pointer-events: auto;
        `;

        // Create status display
        const statusDisplay = document.createElement('div');
        statusDisplay.id = 'sb-export-status';
        statusDisplay.style.cssText = `
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            border-radius: 4px;
            padding: 15px;
            width: 300px;
            max-height: 400px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 12px;
            display: none;
        `;

        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        closeButton.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background-color: transparent;
            color: white;
            border: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
        `;
        closeButton.addEventListener('click', () => {
            statusDisplay.style.display = 'none';
        });
        statusDisplay.appendChild(closeButton);

        // Add status display to container
        statusContainer.appendChild(statusDisplay);

        // Add container to document
        document.documentElement.appendChild(statusContainer);
        return statusDisplay;
    }

    // Log to status display
    function logStatus(message) {
        const statusDisplay = createStatusDisplay();
        statusDisplay.style.display = 'block';

        const logLine = document.createElement('div');
        logLine.innerHTML = message;
        statusDisplay.appendChild(logLine);

        // Auto-scroll to bottom
        statusDisplay.scrollTop = statusDisplay.scrollHeight;

        // Also log to console
        console.log(message);
    }

    // Main export function
    async function startExport() {
        logStatus('🚀 Starting export process...');

        try {
            // Run all three exports in sequence
            logStatus('📥 Starting cashback transactions export...');
            await fetchAllCashbackTransactions();

            logStatus('📤 Starting payment transactions export...');
            await fetchAllPaymentTransactions();

            logStatus('🛒 Starting order history export...');
            await fetchAllOrdersAndDownload();

            logStatus('✅ All exports completed successfully!');
        } catch (error) {
            logStatus(`❌ Error during export: ${error.message}`);
            console.error(error);
        }
    }

    // Function to fetch all cashback transactions (money in)
    async function fetchAllCashbackTransactions() {
        // Initialize variables
        let allCashbackTransactions = [];
        let nextPageToken = null;
        let baseUrl = "https://www.shopback.com.au/api/cashback/search";
        let pageCount = 0;
        let totalTransactions = 0;

        try {
            logStatus("🔍 Starting to fetch cashback transactions...");

            // Get the current browser's User-Agent information
            const userAgentData = navigator.userAgentData || {};
            const platform = userAgentData.platform || navigator.platform || "";
            const mobile = userAgentData.mobile ? "?1" : "?0";

            // Create headers object with dynamic User-Agent information
            const headers = {
                "accept": "application/json",
                "accept-language": navigator.language || "en-AU,en-US;q=0.9,en-GB;q=0.8,en;q=0.7",
                "priority": "u=1, i",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin"
            };

            // Add User-Agent information if available
            if (navigator.userAgent) {
                // Extract browser and version information from User-Agent
                const uaMatch = navigator.userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+\.\d+)/);
                if (uaMatch) {
                    const browserName = uaMatch[1];
                    const browserVersion = uaMatch[2];

                    headers["sec-ch-ua"] = `"Not(A:Brand";v="99", "${browserName}";v="${browserVersion.split('.')[0]}", "Chromium";v="${browserVersion.split('.')[0]}"`;
                    headers["sec-ch-ua-mobile"] = mobile;
                    headers["sec-ch-ua-platform"] = `"${platform}"`;
                }
            }

            do {
                pageCount++;
                logStatus(`📃 Fetching cashback page ${pageCount}...`);

                // Construct URL with next token if available
                let url = nextPageToken ?
                    `${baseUrl}?next=${nextPageToken}` :
                    baseUrl;

                // Make the request using the dynamic headers
                const response = await fetch(url, {
                    "headers": headers,
                    "referrer": "https://www.shopback.com.au/cashback",
                    "referrerPolicy": "strict-origin-when-cross-origin",
                    "body": null,
                    "method": "GET",
                    "mode": "cors",
                    "credentials": "include"
                });

                // Parse the response
                const data = await response.json();

                // Get the total number of transactions from the first response
                if (pageCount === 1 && data && data.meta && data.meta.total) {
                    totalTransactions = data.meta.total;
                    logStatus(`📊 Total cashback transactions to fetch: ${totalTransactions}`);
                }

                // Check if we have data
                if (data && data.data && data.data.length > 0) {
                    logStatus(`✅ Retrieved ${data.data.length} cashback transactions`);
                    allCashbackTransactions.push(...data.data);
                    logStatus(`📈 Progress: ${allCashbackTransactions.length}/${totalTransactions} transactions (${Math.round(allCashbackTransactions.length/totalTransactions*100)}%)`);
                } else {
                    logStatus("ℹ️ No cashback data found in this page or end of results reached");
                }

                // Extract the next page token from the pagination.next field
                if (data && data.meta && data.meta.pagination && data.meta.pagination.next) {
                    // Extract just the token part after "next="
                    const nextUrlPath = data.meta.pagination.next;
                    const nextParamMatch = nextUrlPath.match(/next=([^&]+)/);

                    if (nextParamMatch && nextParamMatch[1]) {
                        // Use the token exactly as it appears in the response, without additional encoding
                        nextPageToken = nextParamMatch[1];
                    } else {
                        nextPageToken = null;
                    }
                } else {
                    nextPageToken = null;
                }

                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));

                // Check if we've fetched all transactions
                if (allCashbackTransactions.length >= totalTransactions) {
                    break;
                }

            } while (nextPageToken); // Continue fetching if there's another page

            logStatus(`✅ All cashback transactions retrieved! Total: ${allCashbackTransactions.length} from ${pageCount} pages`);

            // Export the data as a JSON file
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allCashbackTransactions, null, 2));
            const downloadAnchor = document.createElement("a");
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", "cashback_transactions_in.json");
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            document.body.removeChild(downloadAnchor);

            logStatus("📥 Download initiated for cashback transactions");

            return allCashbackTransactions;

        } catch (error) {
            logStatus(`❌ Error fetching cashback transactions: ${error.message}`);

            // If we have partial data, still export it
            if (allCashbackTransactions.length > 0) {
                logStatus(`⚠️ Exporting partial cashback data (${allCashbackTransactions.length} transactions)`);

                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allCashbackTransactions, null, 2));
                const downloadAnchor = document.createElement("a");
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", "partial_cashback_transactions_in.json");
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                document.body.removeChild(downloadAnchor);
            }

            throw error;
        }
    }

    // Function to fetch all payment transactions (money out)
    async function fetchAllPaymentTransactions() {
        // Initialize variables
        let allPaymentTransactions = [];
        let nextPageToken = null;
        let baseUrl = "https://www.shopback.com.au/api/payment/history";
        let pageCount = 0;
        let totalTransactions = 0;

        try {
            logStatus("🔍 Starting to fetch payment transactions...");

            // Get the current browser's User-Agent information
            const userAgentData = navigator.userAgentData || {};
            const platform = userAgentData.platform || navigator.platform || "";
            const mobile = userAgentData.mobile ? "?1" : "?0";

            // Create headers object with dynamic User-Agent information
            const headers = {
                "accept": "application/json",
                "accept-language": navigator.language || "en-AU,en-US;q=0.9,en-GB;q=0.8,en;q=0.7",
                "priority": "u=1, i",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin"
            };

            // Add User-Agent information if available
            if (navigator.userAgent) {
                // Extract browser and version information from User-Agent
                const uaMatch = navigator.userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+\.\d+)/);
                if (uaMatch) {
                    const browserName = uaMatch[1];
                    const browserVersion = uaMatch[2];

                    headers["sec-ch-ua"] = `"Not(A:Brand";v="99", "${browserName}";v="${browserVersion.split('.')[0]}", "Chromium";v="${browserVersion.split('.')[0]}"`;
                    headers["sec-ch-ua-mobile"] = mobile;
                    headers["sec-ch-ua-platform"] = `"${platform}"`;
                }
            }

            do {
                pageCount++;
                logStatus(`📃 Fetching payment page ${pageCount}...`);

                // Construct URL with next token if available
                let url = nextPageToken ?
                    `${baseUrl}?next=${nextPageToken}` :
                    baseUrl;

                // Make the request using the dynamic headers
                const response = await fetch(url, {
                    "headers": headers,
                    "referrer": "https://www.shopback.com.au/payment/history",
                    "referrerPolicy": "strict-origin-when-cross-origin",
                    "body": null,
                    "method": "GET",
                    "mode": "cors",
                    "credentials": "include"
                });

                // Parse the response
                const data = await response.json();

                // Get the total number of transactions from the first response
                if (pageCount === 1 && data && data.meta && data.meta.total) {
                    totalTransactions = data.meta.total;
                    logStatus(`📊 Total payment transactions to fetch: ${totalTransactions}`);
                }

                // Check if we have data - for payment history, the data is in data.withdrawals
                if (data && data.data && data.data.withdrawals && data.data.withdrawals.length > 0) {
                    logStatus(`✅ Retrieved ${data.data.withdrawals.length} payment transactions`);
                    allPaymentTransactions.push(...data.data.withdrawals);
                    logStatus(`📈 Progress: ${allPaymentTransactions.length}/${totalTransactions} transactions (${Math.round(allPaymentTransactions.length/totalTransactions*100)}%)`);
                } else {
                    logStatus("ℹ️ No payment data found in this page or end of results reached");
                }

                // Extract the next page token from the meta.next field
                if (data && data.meta && data.meta.next) {
                    // Use the token exactly as it appears in the response, without additional encoding
                    nextPageToken = data.meta.next;
                } else {
                    nextPageToken = null;
                }

                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));

                // Check if we've fetched all transactions
                if (allPaymentTransactions.length >= totalTransactions) {
                    break;
                }

            } while (nextPageToken); // Continue fetching if there's another page

            logStatus(`✅ All payment transactions retrieved! Total: ${allPaymentTransactions.length} from ${pageCount} pages`);

            // Export the data as a JSON file
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allPaymentTransactions, null, 2));
            const downloadAnchor = document.createElement("a");
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", "cashback_transactions_out.json");
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            document.body.removeChild(downloadAnchor);

            logStatus("📥 Download initiated for payment transactions");

            return allPaymentTransactions;

        } catch (error) {
            logStatus(`❌ Error fetching payment transactions: ${error.message}`);

            // If we have partial data, still export it
            if (allPaymentTransactions.length > 0) {
                logStatus(`⚠️ Exporting partial payment data (${allPaymentTransactions.length} transactions)`);

                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allPaymentTransactions, null, 2));
                const downloadAnchor = document.createElement("a");
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", "partial_cashback_transactions_out.json");
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                document.body.removeChild(downloadAnchor);
            }

            throw error;
        }
    }

    // Function to fetch all order history
    async function fetchAllOrdersAndDownload() {
        let orders = [];
        let before = new Date().toISOString(); // Use current time as initial timestamp
        let limit = 20; // Keep limit at 20 to match valid requests
        let hasMoreData = true;
        let lastOrderNumber = null; // Track last order to prevent loops
        let pageCount = 0;

        try {
            logStatus("🔍 Starting to fetch order history...");

            // Get the current browser's User-Agent information
            const userAgentData = navigator.userAgentData || {};
            const platform = userAgentData.platform || navigator.platform || "";
            const mobile = userAgentData.mobile ? "?1" : "?0";

            // Create dynamic headers based on current browser
            const dynamicHeaders = {
                "accept": "text/x-component",
                "content-type": "text/plain;charset=UTF-8",
                "next-action": "ed3b2f4ce5d02fc879c446ba204ef996f1ea0bd7",
                "next-router-state-tree": "%5B%22%22%2C%7B%22children%22%3A%5B%22ecommerce%22%2C%7B%22children%22%3A%5B%22(profile-pages)%22%2C%7B%22children%22%3A%5B%22order-history%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2C%22%2Fecommerce%2Forder-history%22%2C%22refresh%22%5D%7D%5D%7D%5D%7D%5D%7D%2Cnull%2Cnull%2Ctrue%5D",
                "priority": "u=1, i",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin"
            };

            // Add User-Agent information if available
            if (navigator.userAgent) {
                // Extract browser and version information from User-Agent
                const uaMatch = navigator.userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+\.\d+)/);
                if (uaMatch) {
                    const browserName = uaMatch[1];
                    const browserVersion = uaMatch[2];

                    dynamicHeaders["sec-ch-ua"] = `"Not(A:Brand";v="99", "${browserName}";v="${browserVersion.split('.')[0]}", "Chromium";v="${browserVersion.split('.')[0]}"`;
                    dynamicHeaders["sec-ch-ua-mobile"] = mobile;
                    dynamicHeaders["sec-ch-ua-platform"] = `"${platform}"`;
                }
            }

            while (hasMoreData) {
                pageCount++;
                logStatus(`📃 Fetching orders page ${pageCount}, before: ${before}...`);

                const response = await fetch("https://www.shopback.com.au/ecommerce/order-history", {
                    "headers": dynamicHeaders,
                    "referrer": "https://www.shopback.com.au/ecommerce/order-history",
                    "referrerPolicy": "strict-origin-when-cross-origin",
                    "body": JSON.stringify([`ecommerce/mobile/orders?before=${before}&limit=${limit}`]),
                    "method": "POST",
                    "mode": "cors",
                    "credentials": "include"
                });

                const textResponse = await response.text();

                try {
                    // Extract JSON from response string
                    const jsonMatch = textResponse.match(/\{.*\}/);
                    if (jsonMatch) {
                        const data = JSON.parse(jsonMatch[0]);

                        if (data && data.data && data.data.orders && data.data.orders.length > 0) {
                            let newOrders = data.data.orders;
                            logStatus(`✅ Retrieved ${newOrders.length} orders`);

                            // Prevent duplicate loop on last item
                            if (lastOrderNumber === newOrders[newOrders.length - 1].orderNumber) {
                                logStatus("⚠️ Stopping loop due to duplicate last order.");
                                hasMoreData = false;
                                break;
                            }

                            orders = orders.concat(newOrders);
                            lastOrderNumber = newOrders[newOrders.length - 1].orderNumber; // Track last order number
                            before = newOrders[newOrders.length - 1].paidAt; // Update 'before' timestamp for next request
                            logStatus(`📈 Total orders retrieved: ${orders.length}`);
                        } else {
                            logStatus("🏁 No more orders to fetch");
                            hasMoreData = false; // Stop fetching when no more orders exist
                        }
                    } else {
                        logStatus("❌ Failed to parse JSON from response.");
                        hasMoreData = false;
                    }
                } catch (error) {
                    logStatus(`❌ Error parsing JSON: ${error.message}`);
                    hasMoreData = false;
                }

                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (orders.length === 0) {
                logStatus("❌ No orders found, download not triggered.");
                return [];
            }

            // Convert orders to JSON and trigger download
            const jsonBlob = new Blob([JSON.stringify(orders, null, 2)], { type: "application/json" });
            const downloadLink = document.createElement("a");
            downloadLink.href = URL.createObjectURL(jsonBlob);
            downloadLink.download = "shopback_order_history.json";
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            logStatus(`📥 Download initiated for ${orders.length} orders`);
            return orders;

        } catch (error) {
            logStatus(`❌ Error fetching order history: ${error.message}`);

            // If we have partial data, still export it
            if (orders.length > 0) {
                logStatus(`⚠️ Exporting partial order data (${orders.length} orders)`);

                const jsonBlob = new Blob([JSON.stringify(orders, null, 2)], { type: "application/json" });
                const downloadLink = document.createElement("a");
                downloadLink.href = URL.createObjectURL(jsonBlob);
                downloadLink.download = "partial_shopback_order_history.json";
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            }

            throw error;
        }
    }

    // Function to ensure the button is added
    function ensureButtonExists() {
        if (!document.getElementById('sb-export-button-container')) {
            addExportButton();
        }
    }

    // Create a MutationObserver to watch for DOM changes
    const observer = new MutationObserver((mutations) => {
        // Check if our button was removed
        if (!document.getElementById('sb-export-button-container')) {
            addExportButton();
        }
    });

    // Start observing the document with the configured parameters
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Add the button when the page is fully loaded
    window.addEventListener('load', ensureButtonExists);

    // Add button when DOM content is loaded
    document.addEventListener('DOMContentLoaded', ensureButtonExists);

    // Add button immediately as well
    ensureButtonExists();

    // Periodically check if button exists (every 2 seconds)
    setInterval(ensureButtonExists, 2000);

    // Log that the script has initialized
    console.log('ShopBack Transaction Exporter script initialized');
})();
