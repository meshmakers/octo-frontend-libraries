export class EnumTuple<TValue = number> {
  id: string | undefined;
  name: TValue | undefined;
}

export class EnumReader<TValue = number> {


  constructor(private value: Object) {
  }

  public getNamesAndValues(): EnumTuple<TValue>[] {

    return this.getNames().map((n) => {
      // @ts-ignore
      return <EnumTuple<TValue>>{name: this.value[n] as TValue, id: n};
    });
  }

  public getNames(): string[] {
    return Object.keys(this.value);
  }

  private getObjValues(): TValue[] {
    // @ts-ignore
    return Object.keys(this.value).map(k => this.value[k]);
  }
}
