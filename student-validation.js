(function(root){
  'use strict';
  function create(form,fields){
    let attempted=false;
    const groups=fields.map((field,index)=>{
      const inputs=[...form.querySelectorAll(field.name?`input[name="${field.name}"]`:`#${field.id}`)];
      const error=document.createElement('p');
      error.id=`survey-validation-${index}`;
      error.className='survey-field-error';
      error.textContent=field.message;
      error.hidden=true;
      field.container.after(error);
      return {...field,inputs,error};
    });

    function update(){
      const missing=[];
      for(const group of groups){
        const invalid=!group.inputs.some(input=>input.checked);
        group.error.hidden=!invalid;
        group.container.classList.toggle('survey-field-invalid',invalid);
        for(const input of group.inputs){
          const descriptions=new Set((input.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));
          if(invalid){input.setAttribute('aria-invalid','true');descriptions.add(group.error.id);}
          else{input.removeAttribute('aria-invalid');descriptions.delete(group.error.id);}
          if(descriptions.size)input.setAttribute('aria-describedby',[...descriptions].join(' '));
          else input.removeAttribute('aria-describedby');
        }
        if(invalid)missing.push(group);
      }
      const summary=form.querySelector('#validationMessage');
      summary.textContent=missing.length?`필수 응답 ${missing.length}개 확인 필요`:'';
      return missing;
    }

    form.addEventListener('change',()=>{if(attempted)update();});
    // Custom messages replace native bubbles; required semantics remain on controls.
    form.noValidate=true;
    return {validate(){
      attempted=true;
      const missing=update();
      if(!missing.length)return true;
      const first=missing[0];
      first.inputs[0].focus({preventScroll:true});
      first.container.scrollIntoView({block:'center',behavior:'instant'});
      return false;
    }};
  }
  root.IeumStudentValidation={create};
})(globalThis);
