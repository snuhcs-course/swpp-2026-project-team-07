import {useStore,visibleDecks} from '../presentations/store';
import {useDeckModel} from '../presentations/useDeckModel';
import {useDurableQa} from './useDurableQa';
export function InitialQaHost(){useStore(s=>s.version);return <>{visibleDecks().map(d=><Worker key={d.id} id={d.id}/>)}</>;}
function Worker({id}:{id:string}){const model=useDeckModel(id);return model?.state.run?<Initial model={model}/>:null;}
function Initial({model}:{model:NonNullable<ReturnType<typeof useDeckModel>>}){useDurableQa(model,true);return null;}
