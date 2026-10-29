(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IeumTeacherContextLoader = api;
})(globalThis, function () {
  function create({
    getTeacherSession, captureTeacherContext, teacherRpc, getDefaults,
    setSettings, clearSensitiveState, renderAuthState, showToast,
    openSettings, renderContext, refreshResponses, refreshPilotReadiness,
    warn,
  }) {
    let loadVersion = 0;

    function normalizeContext(context) {
      return {
        ...getDefaults(), ...context,
        students: (context?.students || []).map(student => ({
          number: Number(student.number), name: student.name,
          studentId: student.student_id || student.studentId || null,
          transferredOn: student.transferredOn || student.transferred_on || null,
        })),
      };
    }

    async function loadTeacherContext() {
      if (!getTeacherSession()) return;
      const valid = captureTeacherContext();
      const version = ++loadVersion;
      const isCurrent = () => valid() && version === loadVersion;
      const classes = await teacherRpc('teacher_get_my_classes');
      if (!isCurrent()) return;
      if (!classes.length) {
        clearSensitiveState();
        renderAuthState();
        openSettings();
        showToast('학급 정보를 입력하고 새 학급을 만들어 주세요. 기존 데이터가 있을 때만 이전 기능을 사용합니다.');
        return;
      }
      const classId = classes[0].class_id;
      if (String(classId).startsWith('demo-')) {
        try {
          await teacherRpc('teacher_roll_demo_months_forward_auth', {p_class_id: classId});
        } catch (error) {
          if (!isCurrent()) return;
          warn('데모 월별 자료 자동 최신화를 건너뜁니다.', error);
        }
      }
      if (!isCurrent()) return;
      const context = await teacherRpc('teacher_get_class_context_auth', {p_class_id: classId});
      if (!isCurrent()) return;
      setSettings(normalizeContext(context));
      const loadedContext = captureTeacherContext();
      renderContext();
      await refreshResponses(false);
      if (loadedContext() && version === loadVersion) await refreshPilotReadiness();
    }

    async function bootstrapTeacherApp() {
      renderAuthState();
      try {
        await loadTeacherContext();
      } catch (error) {
        if (!getTeacherSession()) {
          clearSensitiveState();
          renderAuthState();
        } else {
          showToast(`학급 정보를 불러오지 못했습니다: ${error.message}`);
        }
      }
    }

    return {loadTeacherContext, bootstrapTeacherApp};
  }
  return {create};
});
