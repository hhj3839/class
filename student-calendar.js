(function(root){
  function calendarMonths(endMonth){
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(endMonth))throw new Error('Invalid month');
    const [year,month]=endMonth.split('-').map(Number);
    return Array.from({length:12},(_,i)=>new Date(Date.UTC(year,month-12+i,1)).toISOString().slice(0,7));
  }
  function observationMonthState(observations,student,month){
    const own=observations.filter(row=>row.studentId&&student.studentId?row.studentId===student.studentId:Number(row.studentNumber)===Number(student.number));
    const matches=own.filter(row=>String(row.surveyMonth||'').slice(0,7)===month);
    return matches.some(row=>row.status==='done')?'확인 완료':matches.length?'확인 예정':'';
  }
  const api={calendarMonths,observationMonthState};
  if(typeof module!=='undefined')module.exports=api;
  else root.StudentCalendar=api;
})(typeof window!=='undefined'?window:this);
