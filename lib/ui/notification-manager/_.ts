const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

import {
    create_stylesheet_link,
} from 'lib/ui/dom-tools';

import {
    create_element,
} from 'lib/ui/dom-tools';


export async function load_stylesheet() {
    create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));
}


export class NotificationManager {
    get CLASS (){ return this.constructor as typeof NotificationManager; }

    static notification_area_css_class    = 'notification-area';
    static notification_message_css_class = 'notification-message';

    static notification_message_default_timeout_ms = 3000;

    /** @param {Element} parent for notification area (default: document.body)
     */
    constructor(parent: Element = document.body) {
        if (!(parent instanceof Element)) {
            throw new Error('parent must be an instance of Element');
        }
        this.#parent = parent;
    }

    #parent:  Element;
    #area_id: undefined|string;

    add(message: string, timeout: number = this.CLASS.notification_message_default_timeout_ms) {
        if (typeof message !== 'string') {
            throw new Error('message must be an instance of string');
        }
        if (typeof timeout !== 'number' || timeout <= 0) {
            throw new Error('timeout must be a positive number');
        }
        const area = this.#establish_area();
        const notification = create_element({
            parent: area,
            innerText: message,
            attrs: {
                class: this.CLASS.notification_message_css_class,
            },
        });
        const timeout_id = setTimeout(() => {
            notification.remove();
            this.update_after_remove();
        }, timeout);
    }

    update_after_remove() {
        const area = this.#get_area();
        if (area && area.getElementsByClassName(this.CLASS.notification_message_css_class).length <= 0) {
            this.#area_id = undefined;
            area.remove();
        }
    }

    #get_area(): undefined|Element {
        if (!this.#area_id) {
            return undefined;
        } else {
            return document.getElementById(this.#area_id) ?? undefined;
        }
    }

    #establish_area(): Element {
        const area = this.#get_area() ?? create_element({
            parent: this.#parent,
            set_id: true,
            attrs: {
                class: this.CLASS.notification_area_css_class,
            },
        });
        this.#area_id = area.id;
        return area;
    }
}
