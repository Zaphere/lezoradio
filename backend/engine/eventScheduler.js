// backend/engine/eventScheduler.js
// Cron-based bulletins and announcements using node-cron + DB schedules.

import cron from 'node-cron';
import { supabase } from '../supabaseClient.js';
import { getHourInTimezone, getMinuteInTimezone } from './utils/timezone.js';

const scheduledTasks = new Map();
let onBulletinCallback = null;
let onStationIdCallback = null;
let onTimeAnnouncementCallback = null;

/**
 * Set callbacks for scheduled events.
 */
export function setCallbacks({ onBulletin, onStationId, onTimeAnnouncement }) {
  onBulletinCallback = onBulletin || null;
  onStationIdCallback = onStationId || null;
  onTimeAnnouncementCallback = onTimeAnnouncement || null;
}

/**
 * Load active bulletins from DB and schedule them.
 */
export async function scheduleBulletins() {
  // Clear existing tasks
  for (const task of scheduledTasks.values()) {
    task.stop();
  }
  scheduledTasks.clear();

  const { data: bulletins, error } = await supabase
    .from('bulletin_schedule')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error(`[${new Date().toISOString()}] [eventScheduler] Failed to load bulletins:`, error.message);
    return;
  }

  const { data: channels } = await supabase
    .from('station_channels')
    .select('*')
    .eq('is_active', true);

  if (!bulletins || !channels) return;

  for (const bulletin of bulletins) {
    for (const channel of channels) {
      const timezone = channel.timezone || 'Africa/Kinshasa';
      const cronExpr = `${bulletin.minute} ${bulletin.hour} * * *`;

      if (!cron.validate(cronExpr)) {
        console.warn(`[eventScheduler] Invalid cron: ${cronExpr} for bulletin ${bulletin.id}`);
        continue;
      }

      const taskId = `bulletin:${bulletin.id}:${channel.channel_id}`;
      const task = cron.schedule(cronExpr, () => {
        console.log(`[${new Date().toISOString()}] [eventScheduler] Triggering bulletin for ${channel.channel_id}`);
        if (onBulletinCallback) {
          onBulletinCallback({
            bulletinId: bulletin.id,
            channelId: channel.channel_id,
            stationId: channel.station_id,
            timezone,
            label: bulletin.label,
          });
        }
      }, { timezone });

      scheduledTasks.set(taskId, task);
    }
  }

  console.log(`[${new Date().toISOString()}] [eventScheduler] Scheduled ${bulletins.length} bulletins across ${channels.length} channels`);
}

/**
 * Schedule station ID jingles using randomized intervals.
 */
export function scheduleStationIds(channels, engineConfig) {
  for (const channel of channels) {
    const minMs = engineConfig?.station_id_interval_min_ms || 180000;  // 3 min (reduced from 5)
    const maxMs = engineConfig?.station_id_interval_max_ms || 300000;  // 5 min (reduced from 10)
    const intervalMs = minMs + Math.random() * (maxMs - minMs);

    const taskId = `station_id:${channel.channel_id}`;
    if (scheduledTasks.has(taskId)) {
      scheduledTasks.get(taskId).stop();
    }

    // Use setInterval for randomized intervals
    const intervalId = setInterval(() => {
      console.log(`[${new Date().toISOString()}] [eventScheduler] Station ID for ${channel.channel_id}`);
      if (onStationIdCallback) {
        onStationIdCallback({
          channelId: channel.channel_id,
          stationId: channel.station_id,
          stationName: channel.name || channel.station_name || 'Radio Lezo',
          timezone: channel.timezone,
        });
      }
    }, intervalMs);

    scheduledTasks.set(taskId, { stop: () => clearInterval(intervalId) });
  }
  console.log(`[${new Date().toISOString()}] [eventScheduler] Station IDs scheduled for ${channels.length} channels`);
}

/**
 * Schedule time announcements (every 30 minutes).
 */
export function scheduleTimeAnnouncements(channels) {
  // Use cron for time announcements
  const cronExpr = '0 * * * *';
  const taskId = 'time_announcements';

  if (scheduledTasks.has(taskId)) {
    scheduledTasks.get(taskId).stop();
  }

  const task = cron.schedule(cronExpr, () => {
    for (const channel of channels) {
      const timezone = channel.timezone || 'Africa/Kinshasa';
      const hour = getHourInTimezone(timezone);
      const minute = getMinuteInTimezone(timezone);

      console.log(`[${new Date().toISOString()}] [eventScheduler] Time announcement for ${channel.channel_id}: ${hour}:${String(minute).padStart(2, '0')}`);

      if (onTimeAnnouncementCallback) {
        onTimeAnnouncementCallback({
          channelId: channel.channel_id,
          stationId: channel.station_id,
          timezone,
          hour,
          minute,
        });
      }
    }
  });

  scheduledTasks.set(taskId, task);
  console.log(`[${new Date().toISOString()}] [eventScheduler] Time announcements scheduled`);
}

/**
 * Stop all scheduled tasks.
 */
export function stopAll() {
  for (const [taskId, task] of scheduledTasks) {
    task.stop();
  }
  scheduledTasks.clear();
  console.log(`[${new Date().toISOString()}] [eventScheduler] All tasks stopped`);
}
