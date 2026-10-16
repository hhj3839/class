/* One accessible in-app confirmation at a time. No native blocking dialogs. */
let activeUiDialog=false;
function uiRequest(message,withInput=false){
  if(activeUiDialog)return Promise.resolve(withInput?null:false);
  activeUiDialog=true;
  return new Promise(resolve=>{
    const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className='ui-confirm-dialog';
    dialog.setAttribute('aria-labelledby','uiConfirmTitle');dialog.setAttribute('aria-describedby','uiConfirmDescription');
    const title=document.createElement('h2');title.id='uiConfirmTitle';title.textContent=withInput?'사유 입력':'작업 확인';
    const description=document.createElement('p');description.id='uiConfirmDescription';description.textContent=message;
    dialog.append(title,description);
    let input;if(withInput){input=document.createElement('textarea');input.setAttribute('aria-label','작업 사유');input.rows=3;dialog.append(input);}
    const actions=document.createElement('div');actions.className='dialog-actions';
    const cancel=document.createElement('button'),accept=document.createElement('button');cancel.type=accept.type='button';cancel.className='secondary-button';accept.className='primary-button';cancel.textContent='취소';accept.textContent='확인';actions.append(cancel,accept);dialog.append(actions);
    let finished=false;const finish=value=>{if(finished)return;finished=true;dialog.close();dialog.remove();activeUiDialog=false;if(previous?.isConnected)previous.focus();resolve(value);};
    cancel.onclick=()=>finish(withInput?null:false);accept.onclick=()=>{if(withInput&&!input.value.trim()){input.focus();return;}finish(withInput?input.value.trim():true);};
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(withInput?null:false);});
    if(withInput){accept.disabled=true;input.addEventListener('input',()=>accept.disabled=!input.value.trim());}
    document.body.append(dialog);dialog.showModal();(withInput?input:cancel).focus();
  });
}
function uiConfirm(message){return uiRequest(message);}
function uiPrompt(message){return uiRequest(message,true);}
