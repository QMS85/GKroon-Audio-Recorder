const WebSocket = require('ws');
const fs = require('fs');
const wav = require('node-wav');
const path = require('path');
const { execSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');

// Initialize WebSocket Server on Port 3000
const wss = new WebSocket.Server({ port: 3000 });
console.log('🚀 Node.js Audio receiver listening on ws://localhost:3000');

// Audio Format and Operational Constraints Configuration
const SAMPLE_RATE = 44100;
const BYTES_PER_SAMPLE = 2; // 16-bit PCM Audio Depth
const CHANNELS = 2; // Fixed Stereo Layout
const MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024; // 250 Megabytes structural threshold limit

// Precise calculation of elements per channel buffer array frame allocation limit
const MAX_SAMPLES_PER_CHANNEL = MAX_FILE_SIZE_BYTES / (BYTES_PER_SAMPLE * CHANNELS);

/**
 * Encodes floating point binary streams to 16-bit PCM, runs FFmpeg amplitude 
 * volume adjustment optimization, and exports file safely to local disk.
 */
function normalizeAndSaveWav(rawStereoData, segmentIndex) {
    const timestamp = Date.now();
    const tempPath = path.join(__dirname, `temp_seg_${segmentIndex}_${timestamp}.wav`);
    const finalPath = path.join(__dirname, `normalized_seg_${segmentIndex}_${timestamp}.wav`);

    console.log(`\n[Segment ${segmentIndex}] Processing uncompressed PCM data stream...`);
    
    // Pass standard nested channel Float32 array vectors to encoder layout library block matrix mapping
    const wavBuffer = wav.encode(rawStereoData, { 
        sampleRate: SAMPLE_RATE, 
        float: false, // false = target standard Integer format compilation (16-bit)
        bitDepth: 16 
    });
    
    fs.writeFileSync(tempPath, wavBuffer);

    try {
        console.log(`[Segment ${segmentIndex}] Analyzing and matching peak amplitude headroom...`);
        
        // Execute automated command extraction string against local FFmpeg binary
        execSync(`"${ffmpeg}" -i "${tempPath}" -af "volumedetect,volume=eval=peak" "${finalPath}" -y`, { stdio: 'ignore' });
        console.log(`✅ Segment successfully finalized: ${finalPath}`);
    } catch (error) {
        console.error(`⚠️ Normalization engine error. Exporting un-normalized safety buffer fallback output instead:`, error.message);
        fs.renameSync(tempPath, finalPath);
    } finally {
        // Clean up temporary pre-normalized artifacts safely from the hard drive
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
    }
}

wss.on('connection', (ws) => {
    console.log('\n📥 Chrome Extension sidepanel connected. Recording started.');
    
    let leftChannel = [];
    let rightChannel = [];
    let segmentCount = 1;

    ws.on('message', (message) => {
        if (message instanceof Buffer) {
            // Unpack flat binary payload array data frame stream structure mapping
            const floatArray = new Float32Array(message.buffer, message.byteOffset, message.byteLength / 4);
            
            // De-interleave channel inputs safely: [L, R, L, R, L, R...]
            for (let i = 0; i < floatArray.length; i += 2) {
                leftChannel.push(floatArray[i]);
                rightChannel.push(floatArray[i + 1]);
            }

            // Boundary validation check: evaluate memory array dimensions against limits
            if (leftChannel.length >= MAX_SAMPLES_PER_CHANNEL) {
                console.log(`\n🚨 Limit reached! 250 MB data boundary detected. Auto-segmenting track output...`);
                
                const snapShotStereo = [new Float32Array(leftChannel), new Float32Array(rightChannel)];
                const currentSegment = segmentCount;
                
                // Route buffer mapping directly to disk worker loop asynchronously via zero-delay timers
                setTimeout(() => normalizeAndSaveWav(snapShotStereo, currentSegment), 0);

                // Flush working structural heap arrays cleanly for subsequent packet streams
                leftChannel = [];
                rightChannel = [];
                segmentCount++;

                // Transmit rotation notification sync flags directly back to client interface listener loop
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'SEGMENT_ROTATED' }));
                }
            }
        }
    });

    ws.on('close', () => {
        console.log('\n🛑 Connection terminated. Wrapping up final audio frames...');
        if (leftChannel.length > 0) {
            const finalStereo = [new Float32Array(leftChannel), new Float32Array(rightChannel)];
            normalizeAndSaveWav(finalStereo, segmentCount);
        }
        console.log('System clean. Monitoring for next connection query cycle...\n');
    });
});

