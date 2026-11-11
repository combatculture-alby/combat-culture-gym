/** Temporary question copy: replace this bank after the quiz-design pass.
 * Recruitment rules, scoring and save data do not depend on its wording. */
export const PHONE_RECRUIT_THRESHOLD=5;
export const PHONE_RECRUITS=['Holly','Gao'] as const;
export const PHONE_QUIZ=[
  {question:'A new student asks what to bring to class. What is best?',choices:['Water and comfortable training clothes','Only expensive equipment','Nothing, not even water'],correct:0},
  {question:'A training partner looks injured. What should you do?',choices:['Keep sparring harder','Stop and tell the coach','Ignore it'],correct:1},
  {question:'Why should students warm up before training?',choices:['To prepare their body to move','To skip technique practice','To avoid drinking water'],correct:0},
  {question:'Someone is brand new to Muay Thai. What is a good first step?',choices:['Start with safe fundamentals','Jump into hard sparring','Avoid asking questions'],correct:0},
  {question:'What matters most when practicing with partners?',choices:['Winning every drill','Training safely and respectfully','Going as fast as possible'],correct:1},
  {question:'A student asks how often to drink water. What do you suggest?',choices:['Avoid water during class','Drink only at the end','Hydrate before and during training'],correct:2}
] as const;
export function phoneQuizFor(day:number,call:number):number{
  return (Math.max(1,Math.floor(day))+Math.max(0,Math.floor(call)))%PHONE_QUIZ.length;
}
export function recruitmentPoints(current:number,awarded:number):number{
  return Math.max(0,Math.min(PHONE_RECRUIT_THRESHOLD,
    Math.floor(Number(current)||0)+Math.max(0,Math.floor(Number(awarded)||0))));
}
