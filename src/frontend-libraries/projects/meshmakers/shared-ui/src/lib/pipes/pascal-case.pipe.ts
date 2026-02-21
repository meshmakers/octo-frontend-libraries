import {Pipe, PipeTransform} from "@angular/core";

@Pipe({
  standalone: true,
  name: "pascalCase"
})
export class PascalCasePipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
