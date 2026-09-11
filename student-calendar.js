(function(root){
  function academicYearMonths(schoolYear){
    const year=Number(schoolYear);
    if(!Number.isInteger(year)||year<1900||year>9998)throw new Error('Invalid school year');
    return Array.from({length:12},(_,index)=>`${year+(index>=10?1:0)}-${String((index+2)%12+1).padStart(2,'0')}`);
  }
  function calendarMonths(endMonth){
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(endMonth))throw new Error('Invalid month');
    const [year,month]=endMonth.split('-').map(Number);
    return Array.from({length:12},(_,i)=>new Date(Date.UTC(year,month-12+i,1)).toISOString().slice(0,7));
  }
  const api={calendarMonths,academicYearMonths};
  if(typeof module!=='undefined')module.exports=api;
  else root.StudentCalendar=api;
})(typeof window!=='undefined'?window:this);
