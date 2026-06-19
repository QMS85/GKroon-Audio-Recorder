const WebSocket = require('ws');
const fs = require('fs');
const wav = require('node-wav');
const path = require('path');
const { execFileSync } = require('child_process'); // Replaced execSync to handle path spaces flawlessly
const ffmpeg = require('ffmpeg-static');

const wss = new WebSocket.Server({ port: 3000 });
console.log('🚀 Node.js Audio receiver listening on ws://localhost:3000');

const SAMPLE_RATE = 44100;
const BYTES_PER_SAMPLE = 2; 
const CHANNELS = 2; 
const MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024; 

const MAX_SAMPLES_PER_CHANNEL = MAX_FILE_SIZE_BYTES / (BYTES_PER_SAMPLE * CHANNELS);

function normalizeAndSaveWav(rawStereoData, segmentIndex, wsClient) {
    const timestamp = Date.now();
    const tempPath = path.join(__dirname, `temp_seg_${segmentIndex}_${timestamp}.wav`);
    const finalPath = path.join(__dirname, `normalized_seg_${segmentIndex}_${timestamp}.wav`);

    console.log(`\n[Segment ${segmentIndex}] Encoding 16-bit uncompressed master buffer...`);
    
    const wavBuffer = wav.encode(rawStereoData, { 
        sampleRate: SAMPLE_RATE, 
        float: false, 
        bitDepth: 16 
    });
    
    fs.writeFileSync(tempPath, wavBuffer);

    try {
        console.log(`[Segment ${segmentIndex}] Normalizing audio peak amplitude...`);
        
        // PASS ARGUMENTS AS AN ARRAY: This bypasses command line spacing parsing bugs entirely
        const ffmpegArgs = [
            '-i', tempPath,
            '-af', 'volumedetect,volume=eval=peak',
            finalPath,
            '-y'
        ];
        
        execFileSync(ffmpeg, ffmpegArgs, { stdio: 'ignore' });
        console.log(`✅ File saved successfully to disk: ${finalPath}`);

        // Tell the user interface that processing completed successfully
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
            wsClient.send(JSON.stringify({ type: 'PROCESSING_COMPLETE', path: finalPath }));
        }
    } catch (error) {
        console.error(`⚠️ Normalization failed. Exporting raw fallback audio:`, error.message);
        fs.renameSync(tempPath, finalPath);
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
            wsClient.send(JSON.stringify({ type: 'PROCESSING_COMPLETE', path: finalPath }));
        }
    } finally {
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
            const floatArray = new Float32Array(message.buffer, message.byteOffset, message.byteLength / 4);
            
            for (let i = 0; i < floatArray.length; i += 2) {
                leftChannel.push(floatArray[i]);
                rightChannel.push(floatArray[i + 1]);
            }

            if (leftChannel.length >= MAX_SAMPLES_PER_CHANNEL) {
                console.log(`\n🚨 250 MB Limit reached! Segmenting track...`);
                const snapShotStereo = [new Float32Array(leftChannel), new Float32Array(rightChannel)];
                const currentSegment = segmentCount;
                
                setTimeout(() => normalizeAndSaveWav(snapShotStereo, currentSegment, ws), 0);

                leftChannel = [];
                rightChannel = [];
                segmentCount++;

                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'SEGMENT_ROTATED' }));
                }
            }
        }
    });

    ws.on('close', () => {
        console.log('\n🛑 Connection terminated. Finalizing frames...');
        if (leftChannel.length > 0) {
            const finalStereo = [new Float32Array(leftChannel), new Float32Array(rightChannel)];
            // Pass the active closing socket instance state to process finishing confirmations
            normalizeAndSaveWav(finalStereo, segmentCount, ws);
        }
    });
});

