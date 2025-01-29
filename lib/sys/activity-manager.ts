import {
    SerialDataSource,
} from 'lib/sys/serial-data-source';


// This is a recognizable error representing a stopped condition
export class StoppedError extends Error {};

export type StopState = {
    activity:    Activity,
    was_stopped: boolean,
}

export class Activity {
    /** create a new object representing an Activity, i.e., something that
     *  is running and can be stopped
     *  @param {Boolean} multiple_stops whether or not stop method may be called multiple times
     */
    constructor(multiple_stops: boolean = false) {
        this.#multiple_stops = multiple_stops;
    }

    get multiple_stops (){ return this.#multiple_stops; }
    get stopped        (){ return this.#abort_controller.signal.aborted; }
    get stop_states    (){ return this.#stop_states; }
    get abort_signal   (){ return this.#abort_controller.signal; }

    /** stop this activity.
     *  Calls this.#abort_controller.abort() and therefore this.abort_signal
     *  fires with an 'abort' event.  If this.multiple_stops is true, then
     *  this.#abort_controller will be re-initialized to a new AbortController
     *  instance and this.abort_signal will therefore also return a new,
     *  non-aborted value.  As a consequence, if this.multiple_stops is true,
     *  then this.stopped will always return false.  Otherwise, if
     *  this.multiple_stops is false, then this.stopped will return true
     *  after this.stop() is called.
     */
    stop(): void {
        const was_stopped = this.stopped;
        // note: this is the only place where this.#abort_controller.abort() is called
        this.#abort_controller.abort(new StoppedError('activity stopped'));
        if (this.#multiple_stops) {
            this.#abort_controller = new AbortController();
        }
        this.#stop_states.dispatch({
            activity: this,
            was_stopped,
        });
    }

    // --- internal ---
    readonly #multiple_stops: boolean;  // set in constructor
    #abort_controller = new AbortController();
    #stop_states      = new SerialDataSource<StopState>();

}


/** ActivityManager can be used hierarchically, i.e., an ActivityManager can be
 * added to a different ActivityManager as an Activity,
 */
export class ActivityManager extends Activity {
    constructor(multiple_stops: boolean = false) {
        super(multiple_stops);
        this.#children = [];
    }

    #children: Array<Activity>;  // managed Activity objects
    get children (){ return [ ...this.#children ]; }  // copy to avoid possibility of modification

   /** add an Activity to this.#children
     *  @param {Activity} activity
     * If activity is already present, then do nothing.
     */
    add_activity(activity: Activity): void {
        if (!(activity instanceof Activity)) {
            throw new TypeError('activity must be an instance of Activity');
        }
        if (activity === this) {
            throw new TypeError('cannot this.add_activity() to itself');
        }
        if (!this.#children.includes(activity)) {
            this.#children.push(activity);
        }
    }

    /** remove an Activity object from this.#children
     *  @param {Activity} activity
     *  @return {Boolean} found and removed?
     */
    remove_activity(activity: Activity): boolean {
        if (!(activity instanceof Activity)) {
            throw new TypeError('activity must be an instance of Activity');
        }
        const index = this.#children.indexOf(activity);
        if (index === -1) {
            return false;
        } else {
            this.#children.splice(index, 1);
            return true;
        }
    }

    /** manage the given Activity object.
     *  @param {Activity} activity
     *  @param {Function|undefined} stop_action to be called when activity stopped
     * First, perform this.add_activity(activity).  Later, if a stop_states
     * event for the activity occurs, call stop_action (if given) and finally
     * call this.remove_activity(activity).  Note that stop_action will be
     * called (if given) even if the activity was already removed
     * (which can occur if this manager object was stopped or if
     * this.remove_activity(activity) was already called).
     */
    manage_activity(activity: Activity, stop_action?: () => void): void {
        if (!(activity instanceof Activity)) {
            throw new TypeError('activity must be an instance of Activity');
        }
        if (!['undefined', 'function'].includes(typeof stop_action)) {
            throw new TypeError('stop_action must be undefined or a function');
        }
        this.add_activity(activity);
        const subscription = activity.stop_states.subscribe((state: StopState) => {
            subscription.unsubscribe();  // one-shot
            stop_action?.();
            this.remove_activity(activity);
        });
    }

    /** Stop and remove any activity objects from this.#children,
     * then stop this manager object by calling super.stop().
     */
    stop(): void {
        while (this.#children.length > 0) {
            const activity: undefined|Activity = this.#children.pop();
            activity?.stop();  // note: typescript cannot tell here that activity is not undefined
        }
        super.stop();
    }

    // === DIAGNOSTICS ===

    /** @return {ActivityTree} tree rooted at this ActivityManager
     * For each recursive level, if children is undefined, then that
     * level is an Activity but not an ActivityManager.  Otherwise,
     * if children is not undefined, then that level is an ActivityManager
     * with children as its children.
     */
    tree(): ActivityTree {
        function walk(activity: Activity): ActivityTree {
            return {
                activity,
                children: (activity instanceof ActivityManager)
                    ? activity.#children.map(walk)
                    : undefined,
            };
        }
        return walk(this);
    }

    /** @return {Array} tree rooted at this ActivityManager represented
     * as nested arrays.  Each leaf is a non-ActivityManager Activity,
     * and each array, which represents an ActivityManager, has an additional
     * property "m" that is the associated ActivityManager.
     */
    simple_tree(): any {
        function walk(activity: Activity): any {
            if (!(activity instanceof ActivityManager)) {
                return activity;
            } else {
                const c = activity.#children.map(walk);
                (c as any).m = activity;
                return c;
            }
        }
        return walk(this);
    }
}

export type ActivityTree = {
    activity:  Activity,
    children?: ActivityTree[],  // if not undefined, then activity is an ActivityManager
};
