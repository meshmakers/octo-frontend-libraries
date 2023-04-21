export class GraphQL {

  public static getCursor(position: number): string {
    return btoa(`arrayconnection:${position}`);
  }

  public static offsetToCursor(offset: number): string | null {
    if (!offset) {
      return null;
    }

    return this.getCursor(offset - 1);
  }
}

export const GraphQLCloneIgnoredProperties = ["id", "rtId", "__typename"];
