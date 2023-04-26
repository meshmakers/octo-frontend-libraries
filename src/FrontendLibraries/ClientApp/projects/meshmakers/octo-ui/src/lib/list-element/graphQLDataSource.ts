import {Observable, of} from "rxjs";
import {catchError} from "rxjs/operators";
import {DataSourceBase, MessageService, PagedResultDto} from "@meshmakers/shared-services";
import {FieldFilterDto, SearchFilterDto, SortDto} from "./globalTypes";
export class GraphQLDataSource<TDto> extends DataSourceBase<TDto> {

  constructor(protected messageService: MessageService) {
    super();
    this.abc = 789;
  }
  
  public abc: number;

  public loadData(tenantId: string, skip: number = 0, take: number = 10, searchFilter: SearchFilterDto | null = null,
                  fieldFilter: FieldFilterDto[] | null = null, sort: SortDto[] | null = null) {

    super.onBeginLoad();

    this.executeLoad(tenantId, skip, take, searchFilter, fieldFilter, sort).pipe(
      catchError((error) => {

        this.messageService.showError(error, "Error during load of data");

        return of(new PagedResultDto<TDto>())
      }))
      .subscribe(pagedResult => {

        super.onCompleteLoad(pagedResult);
      });
  }

  protected executeLoad(tenantId: string, skip: number = 0, take: number = 10, searchFilter: SearchFilterDto | null = null,
                        fieldFilter: FieldFilterDto[] | null = null, sort: SortDto[] | null = null): Observable<PagedResultDto<TDto>> {
    return of(new PagedResultDto<TDto>())
  }
}
