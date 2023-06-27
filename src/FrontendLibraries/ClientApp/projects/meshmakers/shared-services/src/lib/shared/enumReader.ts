export class EnumTuple<TValue = number> {
  id: string | undefined;
  name: TValue | undefined;
}

export class EnumReader<TValue = number> {
  constructor(private readonly value: Object) {
  }

  public getNamesAndValues(): Array<EnumTuple<TValue>> {
    return this.getNames().map((n) => {
      // @ts-expect-error
      return <EnumTuple<TValue>>{ name: this.value[n] as TValue, id: n };
    });
  }

  public getNames(): string[] {
    return Object.keys(this.value);
  }

  private getObjValues(): TValue[] {
    // @ts-expect-error
    return Object.keys(this.value).map(k => this.value[k]);
  }
}
