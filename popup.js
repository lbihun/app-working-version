document.addEventListener("DOMContentLoaded", () => {
    const signalsContainer = document.getElementById("signals-list");

    chrome.storage.local.get("signals", (data) => {
        if (!data || !data.signals || data.signals.length === 0) {
            signalsContainer.textContent = "Немає активних сигналів";
            return;
        }

        signalsContainer.textContent = ""; // Очищення перед додаванням

        data.signals.forEach(signal => {
            const signalElement = document.createElement("div");
            signalElement.innerHTML = `
                <strong>${signal.symbol}</strong> - ${signal.direction} 
                <br> <strong>Take Profit:</strong> ${signal.takeProfit} 
                <br> <strong>Confidence:</strong> ${signal.confidence}%
                <br> <strong>Recommended Leverage:</strong> ${signal.leverage}x
                <hr>
            `;
            signalsContainer.appendChild(signalElement);
        });
    });
});
