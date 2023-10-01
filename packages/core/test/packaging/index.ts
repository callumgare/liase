import assert from 'node:assert'

;(async () => {
    try {
        const { createMediaFinderQuery } = await import("media-finder");
        assert.equal(typeof createMediaFinderQuery, "function")
        
    } catch (error) {
        console.error("Could not import media-finder package. Is it built?")
        process.exit(1)
    }
})();