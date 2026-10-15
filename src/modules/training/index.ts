/** Training's public API (CLAUDE.md section 6): the only file other modules,
 *  Core and front may import. Turnfin Me's staff API reads a person's own
 *  training through it, and takes their courses lesson by lesson. */
export {
  checkQuizAnswer, completeLessonFor, completeTrainingFor, myCertificate, myCourse, myCourseFile, myExam, myExamPaper, myExamResult, myLesson, myTraining,
  myPlan, myPractical, saveExamAnswer,
  answerRefresher, catalogueCover, catalogueFor, enrolMyself, myFeedback, myLessonNote, myRecord, myRefresher, mySaved, rateCourse, refresherWaiting, saveLessonNote, searchMyTraining, startExam, submitExam, trainingFileResponse, trainingReminderItems,
} from "@/modules/training/features/me";
