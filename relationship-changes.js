(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.IeumRelationshipChanges=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function compare(responses,students,month,data){
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))return null;
    const date=new Date(`${month}-01T00:00:00Z`);date.setUTCMonth(date.getUTCMonth()-1);const previousMonth=date.toISOString().slice(0,7);
    const rows=data.normalizeResponses(responses,students),at=period=>new Map(rows.filter(row=>row.survey_month.slice(0,7)===period).map(row=>[row.student_number,row])),before=at(previousMonth),current=at(month);
    const identity=(row,student)=>{
      if(!row)return false;
      const expected=student.studentId||student.student_id,actual=row.student_id||row.studentId;
      // Number reuse and missing stable identity cannot establish a comparable person.
      if(!expected||!actual||expected!==actual)return false;
      const oldNumber=row.payload_json?.studentNumber;
      return !oldNumber||Number(oldNumber)===Number(student.number);
    };
    const score=(row,target)=>row?.payload_json.relationships.find(item=>item.targetNumber===target)?.score;
    const pairs=[];
    students.forEach((student,index)=>students.slice(index+1).forEach(other=>{
      const a=Number(student.number),b=Number(other.number),records=[before.get(a),before.get(b),current.get(a),current.get(b)],values=[score(records[0],b),score(records[1],a),score(records[2],b),score(records[3],a)];
      let state='unobserved';
      if(records.some(row=>!row)||values.some(value=>value===undefined))state='missing';
      else if(!identity(records[0],student)||!identity(records[1],other)||!identity(records[2],student)||!identity(records[3],other))state='identity';
      else{const oldHigh=values[0]>=4&&values[1]>=4,newHigh=values[2]>=4&&values[3]>=4;state=newHigh?(oldHigh?'continued':'new'):(oldHigh?'below':'other')}
      pairs.push({a,b,state});
    }));
    const summarize=list=>({comparable:list.filter(pair=>['new','continued','below','other'].includes(pair.state)).length,new:list.filter(pair=>pair.state==='new'),continued:list.filter(pair=>pair.state==='continued'),below:list.filter(pair=>pair.state==='below'),missing:list.filter(pair=>pair.state==='missing'),identity:list.filter(pair=>pair.state==='identity')});
    return{month,previousMonth,hasPrevious:before.size>0,pairs,total:summarize(pairs),byStudent:new Map(students.map(student=>[Number(student.number),summarize(pairs.filter(pair=>pair.a===Number(student.number)||pair.b===Number(student.number)))]))};
  }
  return{compare};
});
