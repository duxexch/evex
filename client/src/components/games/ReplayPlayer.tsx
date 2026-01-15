import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Play, Pause, SkipBack, SkipForward, FastForward, Rewind } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface ReplayEvent {
  id: string;
  eventType: string;
  eventData: string;
  timestamp: number;
  sequenceNumber: number;
  playerId?: string;
}

interface ReplayPlayer {
  id: string;
  userId: string;
  position: number;
  color?: string;
  isWinner: boolean;
  username?: string;
  nickname?: string;
  profilePicture?: string;
}

interface ReplayPlayerProps {
  events: ReplayEvent[];
  players: ReplayPlayer[];
  duration: number;
  gameName?: string;
  onEventReached?: (event: ReplayEvent, index: number) => void;
  renderGameState?: (currentEvent: ReplayEvent | null, events: ReplayEvent[]) => React.ReactNode;
}

export function ReplayPlayerComponent({
  events,
  players,
  duration,
  gameName,
  onEventReached,
  renderGameState
}: ReplayPlayerProps) {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentEventIndex, setCurrentEventIndex] = useState(-1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventIndexRef = useRef(-1);

  const currentEvent = currentEventIndex >= 0 && currentEventIndex < events.length 
    ? events[currentEventIndex] 
    : null;

  const eventsUpToCurrent = events.filter((_, idx) => idx <= currentEventIndex);

  const findEventIndexAtTime = useCallback((time: number) => {
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].timestamp <= time) {
        return i;
      }
    }
    return -1;
  }, [events]);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + (100 * playbackSpeed);
          if (newTime >= duration) {
            setIsPlaying(false);
            return duration;
          }
          return newTime;
        });
      }, 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, duration]);

  useEffect(() => {
    const newEventIndex = findEventIndexAtTime(currentTime);
    if (newEventIndex !== currentEventIndex) {
      setCurrentEventIndex(newEventIndex);
      
      if (newEventIndex > lastEventIndexRef.current && newEventIndex >= 0) {
        const event = events[newEventIndex];
        onEventReached?.(event, newEventIndex);
      }
      lastEventIndexRef.current = newEventIndex;
    }
  }, [currentTime, findEventIndexAtTime, currentEventIndex, events, onEventReached]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    lastEventIndexRef.current = findEventIndexAtTime(newTime);
  };

  const handleSkipToStart = () => {
    setCurrentTime(0);
    setCurrentEventIndex(-1);
    lastEventIndexRef.current = -1;
    setIsPlaying(false);
  };

  const handleSkipToEnd = () => {
    setCurrentTime(duration);
    setCurrentEventIndex(events.length - 1);
    lastEventIndexRef.current = events.length - 1;
    setIsPlaying(false);
  };

  const handleStepBack = () => {
    if (currentEventIndex > 0) {
      const prevEvent = events[currentEventIndex - 1];
      setCurrentTime(prevEvent.timestamp);
    } else {
      setCurrentTime(0);
    }
  };

  const handleStepForward = () => {
    if (currentEventIndex < events.length - 1) {
      const nextEvent = events[currentEventIndex + 1];
      setCurrentTime(nextEvent.timestamp);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const speeds = [0.5, 1, 1.5, 2, 4];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              {gameName && <Badge variant="secondary">{gameName}</Badge>}
              <span>{t('replay.viewer')}</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('replay.move')}</span>
              <Badge variant="outline">
                {currentEventIndex + 1} / {events.length}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  player.isWinner ? 'bg-green-500/10 border border-green-500/30' : 'bg-muted'
                }`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={player.profilePicture || undefined} />
                  <AvatarFallback>
                    {(player.nickname || player.username || 'P')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {player.nickname || player.username || `Player ${player.position + 1}`}
                  </span>
                  {player.color && (
                    <span className="text-xs text-muted-foreground">{player.color}</span>
                  )}
                </div>
                {player.isWinner && (
                  <Badge variant="default" className="bg-green-500 text-white">
                    {t('replay.winner')}
                  </Badge>
                )}
              </div>
            ))}
          </div>

          {renderGameState && (
            <div className="min-h-[300px] bg-muted/50 rounded-lg p-4">
              {renderGameState(currentEvent, eventsUpToCurrent)}
            </div>
          )}

          <div className="space-y-2">
            <Slider
              data-testid="slider-replay-progress"
              value={[currentTime]}
              onValueChange={handleSeek}
              max={duration}
              step={100}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Button
              data-testid="button-replay-skip-start"
              variant="ghost"
              size="icon"
              onClick={handleSkipToStart}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              data-testid="button-replay-step-back"
              variant="ghost"
              size="icon"
              onClick={handleStepBack}
            >
              <Rewind className="h-4 w-4" />
            </Button>
            <Button
              data-testid="button-replay-play-pause"
              variant="default"
              size="icon"
              onClick={handlePlayPause}
              className="h-12 w-12"
            >
              {isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6" />
              )}
            </Button>
            <Button
              data-testid="button-replay-step-forward"
              variant="ghost"
              size="icon"
              onClick={handleStepForward}
            >
              <FastForward className="h-4 w-4" />
            </Button>
            <Button
              data-testid="button-replay-skip-end"
              variant="ghost"
              size="icon"
              onClick={handleSkipToEnd}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">{t('replay.speed')}:</span>
            {speeds.map((speed) => (
              <Button
                key={speed}
                data-testid={`button-replay-speed-${speed}`}
                variant={playbackSpeed === speed ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPlaybackSpeed(speed)}
              >
                {speed}x
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('replay.eventLog')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[200px] overflow-y-auto space-y-1">
            {eventsUpToCurrent.map((event, idx) => (
              <div
                key={event.id}
                data-testid={`event-log-item-${idx}`}
                className={`text-sm px-2 py-1 rounded cursor-pointer ${
                  idx === currentEventIndex 
                    ? 'bg-primary/10 border border-primary/30' 
                    : 'hover:bg-muted'
                }`}
                onClick={() => setCurrentTime(event.timestamp)}
              >
                <span className="text-muted-foreground mr-2">{formatTime(event.timestamp)}</span>
                <Badge variant="outline" className="mr-2">{event.eventType}</Badge>
                <span className="text-xs text-muted-foreground truncate">
                  {event.eventData.substring(0, 50)}
                  {event.eventData.length > 50 ? '...' : ''}
                </span>
              </div>
            ))}
            {eventsUpToCurrent.length === 0 && (
              <div className="text-center text-muted-foreground py-4">
                {t('replay.noEventsYet')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
