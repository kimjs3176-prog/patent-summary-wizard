 import { TrendingUp, Building2 } from "lucide-react";
 import { PatentData, PatentIndices as PatentIndicesType } from "./types";
 
 interface PatentIndicesProps {
   patentData: PatentData;
 }
 
 function calculateIndices(patentData: PatentData): PatentIndicesType {
   // 기술혁신지수 계산 (0-100)
   // - 청구항 수, 기술분류 다양성, 설명 상세도, 인용 여부 등을 종합
   const claimsCount = patentData.claims?.length || 0;
   const classificationsCount = patentData.classifications?.length || 0;
   const descriptionLength = patentData.description?.length || 0;
   const hasCitations = (patentData.citedByCount || 0) > 0;
   
   // 청구항 점수 (0-30): 1개당 3점, 최대 30점
   const claimsScore = Math.min(claimsCount * 3, 30);
   
   // 기술분류 점수 (0-25): 다양한 IPC 분류는 기술 범위가 넓음을 의미
   const classificationScore = Math.min(classificationsCount * 5, 25);
   
   // 설명 상세도 점수 (0-25): 상세한 설명은 기술 완성도를 의미
   const descriptionScore = Math.min(Math.floor(descriptionLength / 500), 25);
   
   // 인용 보너스 (0-20): 타 특허에 인용되면 기술적 가치가 높음
   const citationScore = hasCitations ? Math.min((patentData.citedByCount || 0) * 4, 20) : 0;
   
   const innovationIndex = Math.min(claimsScore + classificationScore + descriptionScore + citationScore, 100);
   
   // 시장지배력지수 계산 (0-100)
   // - 출원인 유형, 발명자 수, IPC 범위, 피인용 수 등을 종합
   const inventorsCount = patentData.inventors?.length || 0;
   const assignee = patentData.assignee?.toLowerCase() || "";
   const citedByCount = patentData.citedByCount || 0;
   
   // 출원인 유형 판별
   let assigneeType: 'corporate' | 'individual' | 'research' | 'unknown' = 'unknown';
   if (assignee.includes('주식회사') || assignee.includes('(주)') || assignee.includes('corp') || assignee.includes('inc') || assignee.includes('ltd')) {
     assigneeType = 'corporate';
   } else if (assignee.includes('대학') || assignee.includes('연구') || assignee.includes('university') || assignee.includes('institute')) {
     assigneeType = 'research';
   } else if (assignee.length > 0 && assignee.length < 10) {
     assigneeType = 'individual';
   }
   
   // 출원인 유형 점수 (0-30)
   const assigneeScore = assigneeType === 'corporate' ? 30 : 
                         assigneeType === 'research' ? 25 : 
                         assigneeType === 'individual' ? 15 : 10;
   
   // 발명자 수 점수 (0-20): 팀 규모가 클수록 투자 규모가 큼
   const inventorsScore = Math.min(inventorsCount * 4, 20);
   
   // IPC 범위 점수 (0-25): 넓은 기술 분류는 시장 적용 범위가 넓음
   const ipcBreadthScore = Math.min(classificationsCount * 5, 25);
   
   // 피인용 점수 (0-25): 많이 인용될수록 시장 영향력이 큼
   const citedByScore = Math.min(citedByCount * 5, 25);
   
   const marketDominanceIndex = Math.min(assigneeScore + inventorsScore + ipcBreadthScore + citedByScore, 100);
   
   return {
     innovationIndex: Math.round(innovationIndex),
     marketDominanceIndex: Math.round(marketDominanceIndex),
     innovationFactors: {
       claimsCount,
       classificationsCount,
       descriptionLength,
       hasCitations,
     },
     marketFactors: {
       assigneeType,
       inventorsCount,
       ipcBreadth: classificationsCount,
       citedByCount,
     },
   };
 }
 
 function getIndexColor(value: number): string {
   if (value >= 70) return "text-green-600";
   if (value >= 40) return "text-amber-600";
   return "text-red-500";
 }
 
 function getIndexBgColor(value: number): string {
   if (value >= 70) return "bg-green-500";
   if (value >= 40) return "bg-amber-500";
   return "bg-red-400";
 }
 
 function getIndexLabel(value: number): string {
   if (value >= 80) return "매우 높음";
   if (value >= 60) return "높음";
   if (value >= 40) return "보통";
   if (value >= 20) return "낮음";
   return "매우 낮음";
 }
 
 export function PatentIndices({ patentData }: PatentIndicesProps) {
   const indices = calculateIndices(patentData);
   
   return (
     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
       {/* 기술혁신지수 */}
       <div className="p-4 rounded-xl bg-card border border-border/50">
         <div className="flex items-center gap-2 mb-3">
           <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
             <TrendingUp className="w-4 h-4 text-blue-600" />
           </div>
           <div>
             <h4 className="font-medium text-foreground text-sm">기술혁신지수</h4>
             <p className="text-xs text-muted-foreground">Technology Innovation Index</p>
           </div>
         </div>
         
         <div className="flex items-end gap-2 mb-2">
           <span className={`text-3xl font-bold ${getIndexColor(indices.innovationIndex)}`}>
             {indices.innovationIndex}
           </span>
           <span className="text-muted-foreground text-sm mb-1">/ 100</span>
           <span className={`ml-auto text-sm font-medium ${getIndexColor(indices.innovationIndex)}`}>
             {getIndexLabel(indices.innovationIndex)}
           </span>
         </div>
         
         <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
           <div 
             className={`h-full ${getIndexBgColor(indices.innovationIndex)} transition-all duration-500`}
             style={{ width: `${indices.innovationIndex}%` }}
           />
         </div>
         
         <div className="mt-3 text-xs text-muted-foreground space-y-1">
           <p>청구항: {indices.innovationFactors.claimsCount}개</p>
           <p>기술분류: {indices.innovationFactors.classificationsCount}개</p>
         </div>
       </div>
       
       {/* 시장지배력지수 */}
       <div className="p-4 rounded-xl bg-card border border-border/50">
         <div className="flex items-center gap-2 mb-3">
           <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
             <Building2 className="w-4 h-4 text-purple-600" />
           </div>
           <div>
             <h4 className="font-medium text-foreground text-sm">시장지배력지수</h4>
             <p className="text-xs text-muted-foreground">Market Dominance Index</p>
           </div>
         </div>
         
         <div className="flex items-end gap-2 mb-2">
           <span className={`text-3xl font-bold ${getIndexColor(indices.marketDominanceIndex)}`}>
             {indices.marketDominanceIndex}
           </span>
           <span className="text-muted-foreground text-sm mb-1">/ 100</span>
           <span className={`ml-auto text-sm font-medium ${getIndexColor(indices.marketDominanceIndex)}`}>
             {getIndexLabel(indices.marketDominanceIndex)}
           </span>
         </div>
         
         <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
           <div 
             className={`h-full ${getIndexBgColor(indices.marketDominanceIndex)} transition-all duration-500`}
             style={{ width: `${indices.marketDominanceIndex}%` }}
           />
         </div>
         
         <div className="mt-3 text-xs text-muted-foreground space-y-1">
           <p>출원인 유형: {
             indices.marketFactors.assigneeType === 'corporate' ? '기업' :
             indices.marketFactors.assigneeType === 'research' ? '연구기관' :
             indices.marketFactors.assigneeType === 'individual' ? '개인' : '미상'
           }</p>
           <p>발명자: {indices.marketFactors.inventorsCount}명</p>
         </div>
       </div>
     </div>
   );
 }