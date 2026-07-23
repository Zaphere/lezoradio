# Radio Trigger Overlap Fixes

## Issue Summary
Multiple independent trigger paths (BFS silence detection, news polling, French bulletins, FM frequency changes, Scan button) can all call `voice.speak()` simultaneously without coordination, causing overlapping vocals, missed background music, and chaotic playback.

## Fix 1: Exclude intro states from BFS silence detection
**File:** `src/hooks/useBroadcastFlowSupervisor.ts:76-83`

**Change:** Add `INTRO_MUSIC`, `INTRO_DUCKING`, and `HOST_INTRO` to the `isSilent` exclusion list so the BFS doesn't inject recovery speech during the opening sequence.

```diff
     const isSilent = isLive
       && !playedBridgeIntroRef.current
       && broadcastState !== 'IDLE'
       && broadcastState !== 'STOPPING'
+      && broadcastState !== 'INTRO_MUSIC'
+      && broadcastState !== 'INTRO_DUCKING'
+      && broadcastState !== 'HOST_INTRO'
       && voiceState !== 'speaking'
       && voiceState !== 'paused'
       && !isMusicMode
       && !isBehindLive;
```

## Fix 2: Add centralized playback lock to prevent overlapping triggers
**File:** `src/hooks/useRadioEngine.ts`

### 2a: Add `playbackLockRef` after line 131
```diff
   const voiceEndedGuardRef = useRef(false);
+  const playbackLockRef = useRef(false);
   const mountedRef = useRef(false);
```

### 2b: Add lock check at the start of `onVoiceEnded` (line 154) — clear the lock
```diff
   const onVoiceEnded = useCallback(() => {
     if (voiceEndedGuardRef.current) return;
     if (isStoppingRef.current) return;
+    playbackLockRef.current = false;
```

### 2c: Guard `voice.speak(hostIntro)` in `start()` (line 418)
```diff
+          if (playbackLockRef.current) return;
+          playbackLockRef.current = true;
           voice.setVoice(getVoiceForRegion(stationRegion));
```

### 2d: Guard `voice.speak()` in `startNewsPlaybackInternal` → `playNewsItemInternal` (line 299)
```diff
     lastSpokenTextRef.current = fullText;
+    if (playbackLockRef.current) return;
+    playbackLockRef.current = true;
     voice.setVoice(getVoiceForRegion(stationRegion));
```

### 2e: Guard `voice.speak()` in `playFromQueueInternal` (line 548)
```diff
+    if (playbackLockRef.current) return;
+    playbackLockRef.current = true;
     voice.speak(item.script.script, `Now broadcasting from ${stationName}.`);
```

### 2f: Guard `voice.speak()` in `tickInternal` before calling `playFromQueueInternal` (line 590)
```diff
       if (voice.state === 'idle' && queueRef.current.length > 0) {
+        if (playbackLockRef.current) return;
+        playbackLockRef.current = true;
         playFromQueueInternal();
       }
```

## Fix 3: Route bulletins through state machine
**Files:** `src/hooks/useRadioEngine.ts` + `src/pages/Radio.tsx`

### 3a: Add `bulletinActiveRef` in useRadioEngine (after line 131)
```diff
   const playbackLockRef = useRef(false);
+  const bulletinActiveRef = useRef(false);
   const mountedRef = useRef(false);
```

### 3b: Handle bulletin in `onVoiceEnded` (before the state checks, around line 158)
```diff
     if (voiceEndedGuardRef.current) return;
     if (isStoppingRef.current) return;
+    if (bulletinActiveRef.current) {
+      bulletinActiveRef.current = false;
+      return;
+    }
```

### 3c: Add `speakBulletin` method to useRadioEngine (after `enqueueItems`, around line 751)
```typescript
   const speakBulletin = useCallback((text: string, intro?: string) => {
+    bulletinActiveRef.current = true;
+    if (playbackLockRef.current) return;
+    playbackLockRef.current = true;
+    if (intro) {
+      voice.speak(text, intro);
+    } else {
+      voice.speak(text);
+    }
   }, [voice]);
```

### 3d: Export `speakBulletin` in the return object (around line 839)
```diff
     enqueueItems,
+    speakBulletin,
     speakNewsFeed,
```

### 3e: Update `Radio.tsx:248` to use `engine.speakBulletin()`
```diff
       if (newsText) {
-        engine.speak(newsText, bulletinIntro);
+        engine.speakBulletin(newsText, bulletinIntro);
       } else {
-        engine.speak(`Aucune nouvelle disponible...`, bulletinIntro);
+        engine.speakBulletin(`Aucune nouvelle disponible...`, bulletinIntro);
       }
```

## Fix 4: Exclude HOST_INTRO from tick polling
**File:** `src/hooks/useRadioEngine.ts:572`

```diff
-    if (smRef.current.state === 'STOPPING' || smRef.current.state === 'INTRO_MUSIC' || smRef.current.state === 'INTRO_DUCKING') return;
+    if (smRef.current.state === 'STOPPING' || smRef.current.state === 'INTRO_MUSIC' || smRef.current.state === 'INTRO_DUCKING' || smRef.current.state === 'HOST_INTRO') return;
```

## Fix 5: Guard `setFeedItems` during intro states
**File:** `src/hooks/useRadioEngine.ts:692-704`

Add a guard so `setFeedItems` doesn't trigger `startNewsRef.current()` during intro states:

```diff
     if (isLiveRef.current && sorted.length > 0 && hadNoItems) {
       const state = smRef.current.state;
+      if (state === 'INTRO_MUSIC' || state === 'INTRO_DUCKING' || state === 'HOST_INTRO') return;
       if (state === 'ENTERTAINMENT') {
```
