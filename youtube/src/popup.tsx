import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles.css';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Define types for the time object and responses
interface TimeObject {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface PlaylistTimeResponse {
  success: boolean;
  message?: string;
  formatted?: string;
  timeObject?: TimeObject;
}

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeData, setTimeData] = useState<{formatted: string; timeObject: TimeObject} | null>(null);
  const [chunkMinutes, setChunkMinutes] = useState(30);
  const [chunkResult, setChunkResult] = useState<string | null>(null);

  const calculatePlaylistTime = async () => {
    setLoading(true);
    setError(null);
    setTimeData(null);
    setChunkResult(null);

    try {
      // Get active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];

      // Check if we're on a YouTube page
      if (!activeTab.url?.includes('youtube.com')) {
        throw new Error('This extension only works on YouTube pages.');
      }

      // We don't need to check scripting access for YouTube URLs since our content script is already injected
      // The content script should handle access checks internally

      // Use the content script approach since it's already injected
      try {
        console.log('Sending message to content script');
        
        // Check if chrome.scripting is available
        if (typeof chrome.scripting === 'undefined') {
          console.log('chrome.scripting API not available, falling back to content script');
          
          // Use content script messaging instead of direct script execution
          const message = { action: 'getPlaylistTime' };
          chrome.tabs.sendMessage(activeTab.id as number, message, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending message:', chrome.runtime.lastError);
              setError('Error communicating with YouTube page. Please refresh.');
              setLoading(false);
              return;
            }
            
            if (response && response.success) {
              setTimeData({
                formatted: response.formatted,
                timeObject: response.timeObject,
              });
            } else {
              setError(response?.message || 'Failed to calculate playlist time.');
            }
            setLoading(false);
          });
          return; // Exit early since we're handling response in callback
        }
        
        // If chrome.scripting is available, use it as a more reliable method
        console.log('Using chrome.scripting.executeScript');
        const results = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id as number },
          func: () => {
            // In-page script to calculate YouTube playlist duration
            try {
              // Check if this is a playlist page
              if (!window.location.href.includes('playlist')) {
                return { 
                  success: false, 
                  message: 'Not a YouTube playlist page' 
                };
              }
              
              // Get all video time stamps
              const timestamps = document.querySelectorAll(
                'ytd-thumbnail-overlay-time-status-renderer span, span.ytd-thumbnail-overlay-time-status-renderer'
              );
              
              if (!timestamps || timestamps.length === 0) {
                // Try to find playlist videos to give better feedback
                const videos = document.querySelectorAll('ytd-playlist-video-renderer');
                if (videos && videos.length > 0) {
                  return { 
                    success: false, 
                    message: `Found ${videos.length} videos but no timestamps loaded yet. Try again in a moment.` 
                  };
                }
                return { 
                  success: false, 
                  message: 'No videos found in playlist. Try refreshing the page.' 
                };
              }
              
              // Calculate total seconds
              let totalSeconds = 0;
              timestamps.forEach(timestamp => {
                const timeText = timestamp.textContent?.trim() || "";
                // Skip if it doesn't look like a timestamp
                if (!timeText.includes(':')) return;
                
                const timeParts = timeText.split(':').map(part => parseInt(part, 10));
                
                if (timeParts.length === 2) {
                  // MM:SS format
                  totalSeconds += timeParts[0] * 60 + timeParts[1];
                } else if (timeParts.length === 3) {
                  // HH:MM:SS format
                  totalSeconds += timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
                }
              });
              
              // Convert to days, hours, minutes, seconds
              const days = Math.floor(totalSeconds / 86400);
              const hours = Math.floor((totalSeconds % 86400) / 3600);
              const minutes = Math.floor((totalSeconds % 3600) / 60);
              const seconds = totalSeconds % 60;
              
              // Format the time
              let formatted = "";
              if (days > 0) formatted += `${days}d `;
              if (hours > 0 || days > 0) formatted += `${hours}h `;
              if (minutes > 0 || hours > 0 || days > 0) formatted += `${minutes}m `;
              formatted += `${seconds}s`;
              
              return {
                success: true,
                formatted,
                timeObject: { days, hours, minutes, seconds }
              };
            } catch (error) {
              return { 
                success: false, 
                message: `Error: ${error instanceof Error ? error.message : String(error)}` 
              };
            }
          }
        });
        
        // Extract the result
        const playlistTimeResult = results[0].result as PlaylistTimeResponse;
        console.log('Got direct script result:', playlistTimeResult);
        
        if (!playlistTimeResult || !playlistTimeResult.success) {
          throw new Error(playlistTimeResult?.message || 'Failed to calculate playlist time');
        }
        
        // Use the direct result
        // Use the direct result as our response
        const response = playlistTimeResult;
        
        // Store the result
        setTimeData({
          formatted: response.formatted as string,
          timeObject: response.timeObject as TimeObject,
        });
        
        return; // Exit here since we've handled everything
      } catch (error) {
        console.error('Error in direct script execution:', error);
        setError((error as Error).message);
        setLoading(false);
        return; // Exit to prevent further execution
      }

      // This code won't execute if we returned above, but keeping it as fallback
      // for potential content script responses in the future
      setLoading(false);
    } catch (error) {
      console.error('Error calculating playlist time:', error);
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const calculateChunks = () => {
    if (!timeData?.timeObject) return;

    const { days, hours, minutes, seconds } = timeData.timeObject;
    const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;
    const chunks = Math.ceil(totalSeconds / (chunkMinutes * 60));

    setChunkResult(`You need ${chunks} chunk${chunks !== 1 ? 's' : ''} of ${chunkMinutes} minutes each.`);
  };

  return (
    <div className="w-[350px] p-4 font-sans">
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-primary/10 to-secondary/10">
          <CardTitle className="text-lg">YouTube Playlist Timer</CardTitle>
          <CardDescription>Calculate the total time of a YouTube playlist</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <Button 
            onClick={calculatePlaylistTime} 
            disabled={loading}
            className="w-full font-medium"
          >
            {loading ? 'Loading...' : 'Calculate Total Time'}
          </Button>

          {error && (
            <div className="text-destructive text-sm bg-destructive/10 p-2 rounded-md border border-destructive/20">{error}</div>
          )}

          {timeData && (
            <div className="border rounded-md p-3 bg-muted/30">
              <p className="text-sm font-medium text-muted-foreground">Total playlist time:</p>
              <p className="text-lg font-bold tracking-tight">{timeData.formatted}</p>
            </div>
          )}

          {timeData && (
            <div className="space-y-3 pt-2">
              <div className="font-medium text-sm text-muted-foreground">Break into chunks</div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  value={chunkMinutes}
                  onChange={(e) => setChunkMinutes(parseInt(e.target.value) || 30)}
                  placeholder="Minutes per chunk"
                  className="font-mono"
                />
                <Button onClick={calculateChunks} variant="secondary">
                  Calculate
                </Button>
              </div>
              {chunkResult && (
                <div className="text-sm mt-2 p-2 bg-secondary/10 rounded-md font-medium">{chunkResult}</div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground border-t bg-muted/20 py-3">
          Analyze any YouTube playlist to see its total duration
        </CardFooter>
      </Card>
    </div>
  );
}

// Initialize the React app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('app');
  if (container) {
    const root = createRoot(container);
    root.render(<App />);
  }
});