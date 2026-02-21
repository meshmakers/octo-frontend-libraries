import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'bytesToSize'
})
export class BytesToSizePipe implements PipeTransform {

  public transform(value: number, decimals = 2): string {
    if (value === 0) {
      return '0 Bytes';
    }

    const k = 1024; // oder 1000, falls du SI-Berechnung bevorzugst
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

    // Bestimme, in welcher Größenordnung der Wert liegt:
    const i = Math.floor(Math.log(value) / Math.log(k));

    // Umrechnen und Formatieren
    const result = parseFloat((value / Math.pow(k, i)).toFixed(dm));
    return `${result} ${sizes[i]}`;
  }
}
