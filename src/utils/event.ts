/* eslint-disable @typescript-eslint/no-explicit-any */ 
type CallBack = ((...arg: any) => any) | undefined
type EventMap = { [key: number | string]: CallBack }

export default class XEvent<T extends string[] | readonly string[]> {
  nameList: T;
  uidMap: { [key: string]: number } = {};
  eventMap: { [key: string]: EventMap } = {};
  on: (name: T[number], cb: CallBack) => number;
  off: (name: T[number] , uid: number) => void;
  emit: (name: T[number] , ...arg: any) => void;
  clear: (name?: T[number]) => void;

  constructor(nameList: T) {
    this.nameList = nameList;
    nameList.forEach(name => {
      this.uidMap[name] = 0;
      this.eventMap[name] = {};
    });

    this.on = (name: T[number], cb: CallBack): number => {
      const events = this.eventMap[name];
      const cuid = this.uidMap[name];
      if (events && cuid !== undefined && cuid >= 0) {
        events[cuid] = cb;
        this.uidMap[name] = cuid + 1;
        return cuid;
      }
      return -1;
    };

    this.off = (name: T[number], uid: number): void => {
      const events = this.eventMap[name];
      if (events && events[uid]) {
        events[uid] = undefined;
        delete events[uid];
      }
    };

    this.emit = (name: T[number], ...arg: any): void => {
      const events = this.eventMap[name];
      if (events) {
        Object.keys(events).forEach(key => {
          const fn = events[key];
          if (fn) fn(...arg);
        });
      }
    }

    this.clear = (name?: T[number]): void => {
      if (name && this.eventMap[name]) {
        this.eventMap[name] = {};
        this.uidMap[name] = 0;
      } else {
        Object.keys(this.eventMap).forEach(key => {
          this.eventMap[key] = {};
          this.uidMap[key] = 0;
        })
      }
    }
  }
}