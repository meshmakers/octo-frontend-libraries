export class ProgressValue {
  statusText: string | null;
  progressValue: number;

  constructor() {
    this.statusText = null;
    this.progressValue = 0;
  }
}