
document.addEventListener("DOMContentLoaded", () => {
    document
        .getElementById("view-investigation-board-anchor")
        .addEventListener("click", () => {
            chrome.tabs.create(
                { url: '/src/pages/investigation_board.html' }
            );
    });
});
