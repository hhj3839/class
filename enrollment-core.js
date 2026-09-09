(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.IeumEnrollment=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const transferDate=student=>student?.transferredOn||student?.transferred_on||'';
  function status(student,month){const date=transferDate(student);if(!date||month<date.slice(0,7))return 'enrolled';if(month>date.slice(0,7)||date.endsWith('-01'))return 'transferred';return 'partial'}
  function summary(students,submittedNumbers,month){
    const submittedSet=new Set([...submittedNumbers].map(Number)),partial=students.filter(student=>status(student,month)==='partial'),transferred=students.filter(student=>status(student,month)==='transferred');
    const eligible=students.filter(student=>status(student,month)==='enrolled'||(status(student,month)==='partial'&&submittedSet.has(Number(student.number))));
    const submitted=eligible.filter(student=>submittedSet.has(Number(student.number))),missing=eligible.filter(student=>!submittedSet.has(Number(student.number)));
    return{eligible,submitted,missing,partial,transferred,total:eligible.length,rate:eligible.length?Math.round(submitted.length/eligible.length*100):0};
  }
  return{transferDate,status,summary};
});
