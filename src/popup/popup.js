
document.addEventListener("DOMContentLoaded", () => {
    document
        .getElementById("view-investigation-board-anchor")
        .addEventListener("click", () => {
            chrome.tabs.create(
                { url: '/src/pages/investigation_board.html' }
            );
    });

    function resetProgress() {
        chrome.storage.local.getBytesInUse(use => {
            const prog = document.getElementById("storage-use-progress");
            prog.value = use;
            prog.max = chrome.storage.local.QUOTA_BYTES;
        });
    }
    resetProgress();
    setInterval(resetProgress, 2000);

    document
        .getElementById("reset-data-btn")
        .addEventListener("click", () => {
            chrome.storage.local.clear(() => {
                resetProgress();
                const p = document.createElement("p");
                p.innerText = "Saved tracking data has been reset.";
                p.classList.add("alert-row");
                document.getElementById("alert-area").append(p);
                setTimeout(() => {
                    p.remove()
                }, 3500);
            });
    });



});
