document.addEventListener('DOMContentLoaded', () => {

    const videoHandlers = [
        // { videoId: '#experience-video', blurId: '#blurhash-placeholder-experience' },
        { videoId: '#nutrition-video', blurId: '#blurhash-placeholder-nutrition' },
        { videoId: '#evolt-video', blurId: '#blurhash-placeholder-evolt' },
        { videoId: '#training-video', blurId: '#blurhash-placeholder-training' },
        { videoId: '#beat-video', blurId: '#blurhash-placeholder-beat' },
        { videoId: '#predators-video', blurId: '#blurhash-placeholder-predators' },
        { videoId: '#hybrid-video', blurId: '#blurhash-placeholder-hybrid' },
        { videoId: '#reshape-video', blurId: '#blurhash-placeholder-reshape' },
        { videoId: '#elite-video', blurId: '#blurhash-placeholder-elite' }
    ];

    // Iterate over all video handlers and apply event listeners
    videoHandlers.forEach(({ videoId, blurId }) => {
        const videoElement = document.querySelector(videoId);
        const blurElement = document.querySelector(blurId);

        // Adding a fallback for debugging in live environment
        if (videoElement && blurElement) {
            videoElement.addEventListener('loadeddata', () => {
                console.log(`${videoId} loaded successfully`);
                blurElement.style.transition = "opacity 1s ease-out";
                blurElement.style.opacity = "0";  // Hide Blurhash Placeholder
                videoElement.style.opacity = "1"; // Show video
            });

            // Ensure the placeholder is removed after transition
            videoElement.addEventListener('canplaythrough', () => {
                setTimeout(() => {
                    blurElement.style.display = 'none'; // Remove the blur after fade-out
                }, 1000); // 1 second delay to ensure fade-out is complete
            });
        } else {
            console.error(`Error: Could not find elements for ${videoId} or ${blurId}`);
        }
    });
});
