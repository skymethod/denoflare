import { DurableObjectGetAlarmOptions, DurableObjectSetAlarmOptions } from '../cloudflare_workers_types.d.ts';

export class InMemoryAlarms {
    private readonly dispatchAlarm: () => void;

    // alarms not durable, kept in memory only
    private alarm: number | null = null;
    private alarmTimeoutId = 0;

    constructor(dispatchAlarm: () => void) {
        this.dispatchAlarm = dispatchAlarm;
    }

    getAlarm(options: DurableObjectGetAlarmOptions = {}): Promise<number | null> {
        const { allowConcurrency } = options;
        if (allowConcurrency !== undefined) throw new Error(`InMemoryAlarms.getAlarm(allowConcurrency) not implemented: options=${JSON.stringify(options)}`);
        return Promise.resolve(this.alarm);
    }

    setAlarm(scheduledTime: number | Date, options: DurableObjectSetAlarmOptions = {}): Promise<void> {
        const { allowUnconfirmed } = options;
        if (allowUnconfirmed !== undefined) throw new Error(`InMemoryAlarms.setAlarm(allowUnconfirmed) not implemented: options=${JSON.stringify(options)}`);
        this.alarm = Math.max(Date.now(), typeof scheduledTime === 'number' ? scheduledTime : scheduledTime.getTime());
        this.rescheduleAlarm();
        return Promise.resolve();
    }
    
    deleteAlarm(options: DurableObjectSetAlarmOptions = {}): Promise<void> {
        const { allowUnconfirmed } = options;
        if (allowUnconfirmed !== undefined) throw new Error(`InMemoryAlarms.deleteAlarm(allowUnconfirmed) not implemented: options=${JSON.stringify(options)}`);
        this.alarm = null;
        this.rescheduleAlarm();
        return Promise.resolve();
    }

    //

    private rescheduleAlarm() {
        clearTimeout(this.alarmTimeoutId);
        if (typeof this.alarm === 'number') {
            this.alarmTimeoutId = setTimeout(() => {
                this.alarm = null;
                this.dispatchAlarm();
            }, Math.max(0, this.alarm - Date.now()));
        }
    }
    
}
