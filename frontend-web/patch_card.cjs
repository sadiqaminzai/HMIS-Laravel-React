const fs = require('fs');
const file = 'c:/xampp/htdocs/shifaascript/frontend-web/src/app/components/PatientManagement.tsx';
let content = fs.readFileSync(file, 'utf8');

// I will just use regex to target the print regions.
// First, replace the <style> blocks.
content = content.replace(/size: 80mm auto;/g, 'size: 86mm 54mm landscape;');
content = content.replace(/width: 80mm;/g, 'width: 86mm; height: 54mm; display: flex !important;');

// 1. First Print template:
const start1 = content.indexOf('<div id="patient-print-view"');
const end1 = content.indexOf('{/* Screen Modal */}');
if (start1 > 0 && end1 > start1) {
  content = content.substring(0, start1) + `<div id="patient-print-view" className="hidden print:flex w-[86mm] h-[54mm] bg-white relative overflow-hidden flex-row font-sans mx-auto shadow-sm">
            <div className="w-[30%] bg-blue-800 flex flex-col items-center py-2 relative shrink-0">
               <div className="w-9 h-9 bg-white rounded-full p-0.5 flex items-center justify-center mb-1.5 shadow z-10 overflow-hidden">
                  {currentHospital.logo ? (
                    <img src={currentHospital.logo} alt={currentHospital.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="text-blue-800 font-bold text-[14px]">{(contextHospitals.find(h => h.id === selectedPatient.hospitalId)?.name || currentHospital.name || 'H').charAt(0)}</div>
                  )}
               </div>
               <div className="w-[18mm] h-[22mm] bg-gray-200 border-[1.5px] border-white rounded shadow-sm overflow-hidden z-10">
                  {selectedPatient.image ? (
                    <img src={selectedPatient.image} alt={selectedPatient.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-white">
                      <Users className="w-5 h-5" />
                    </div>
                  )}
               </div>
            </div>
            
            <div className="w-[70%] p-2 flex flex-col relative bg-white">
               <div className="text-right border-b border-gray-200 pb-1 mb-1">
                 <h1 className="text-[10px] font-extrabold text-blue-900 uppercase tracking-wide leading-tight line-clamp-1">{contextHospitals.find(h => h.id === selectedPatient.hospitalId)?.name || currentHospital.name}</h1>
                 <p className="text-[7px] text-gray-500 uppercase tracking-widest font-semibold mt-0.5">Patient Identification</p>
               </div>
               
               <div className="mt-0.5">
                 <h2 className="text-[14px] font-black text-gray-900 uppercase tracking-tight leading-tight line-clamp-1">{selectedPatient.name}</h2>
                 
                 <div className="grid grid-cols-2 mt-1.5 gap-x-1 gap-y-1">
                    <div>
                      <div className="text-[6.5px] text-gray-400 uppercase font-bold tracking-wider">Patient ID</div>
                      <div className="text-[10px] font-mono font-bold text-gray-900">{selectedPatient.patientId}</div>
                    </div>
                    <div>
                      <div className="text-[6.5px] text-gray-400 uppercase font-bold tracking-wider">Age / Sex</div>
                      <div className="text-[9px] font-bold text-gray-900">{selectedPatient.age}Y / {selectedPatient.gender?.charAt(0).toUpperCase()}</div>
                    </div>
                    <div className="col-span-2">
                       <div className="text-[6.5px] text-gray-400 uppercase font-bold tracking-wider">Phone</div>
                       <div className="text-[9px] font-bold text-gray-900">{selectedPatient.phone || '-'}</div>
                    </div>
                 </div>
               </div>

               <div className="absolute bottom-1.5 left-2 right-2 flex justify-between items-end">
                  <div className="bg-white">
                     <Barcode value={selectedPatient.patientId} height={16} width={1.3} displayValue={true} fontSize={9} margin={0} background="transparent" />
                  </div>
                  <div className="p-0.5 bg-white border border-gray-200 rounded">
                     <QRCodeSVG value={getPatientQrValue(selectedPatient)} size={28} />
                  </div>
               </div>
            </div>
          </div>

          ` + content.substring(end1);
}

// 2. Second Print template:
const start2 = content.indexOf('<div id="patient-id-card-print"');
// Look for the footer to end the cut.
let footerStart = content.indexOf('<div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 border-t');
if(start2 > 0 && footerStart > start2) {
    // but the closing div of the card-wrapper comes before footerStart.
    // The previous implementation had <div className="p-6 flex justify-center bg-gray-100 dark:bg-gray-900">
    const beforeFooter = content.lastIndexOf('</div>\n            </div>\n\n            <div className="bg-gray-50', footerStart + 200);
    
    // We can just find the immediate parent.
    content = content.substring(0, start2) + `<div id="patient-id-card-print" className="print:flex w-[86mm] h-[54mm] bg-white relative overflow-hidden flex-row font-sans shadow-lg border border-gray-200 print:shadow-none print:border-none mx-auto shrink-0 mb-4 print:mb-0">
                <div className="w-[30%] bg-blue-800 flex flex-col items-center py-2 relative shrink-0">
                   <div className="w-9 h-9 bg-white rounded-full p-0.5 flex items-center justify-center mb-1.5 shadow z-10 overflow-hidden">
                      {currentHospital.logo ? (
                        <img src={currentHospital.logo} alt={currentHospital.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <div className="text-blue-800 font-bold text-[14px]">{(contextHospitals.find(h => h.id === selectedPatient.hospitalId)?.name || currentHospital.name || 'H').charAt(0)}</div>
                      )}
                   </div>
                   <div className="w-[18mm] h-[22mm] bg-gray-200 border-[1.5px] border-white rounded shadow-sm overflow-hidden z-10">
                      {selectedPatient.image ? (
                        <img src={selectedPatient.image} alt={selectedPatient.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-white">
                          <Users className="w-5 h-5" />
                        </div>
                      )}
                   </div>
                </div>
                
                <div className="w-[70%] p-2 flex flex-col relative bg-white">
                   <div className="text-right border-b border-gray-200 pb-1 mb-1">
                     <h1 className="text-[10px] font-extrabold text-blue-900 uppercase tracking-wide leading-tight line-clamp-1">{contextHospitals.find(h => h.id === selectedPatient.hospitalId)?.name || currentHospital.name}</h1>
                     <p className="text-[7px] text-gray-500 uppercase tracking-widest font-semibold mt-0.5" style={{letterSpacing: '0.05em'}}>Patient Identification</p>
                   </div>
                   
                   <div className="mt-0.5 text-left">
                     <h2 className="text-[14px] font-black text-gray-900 uppercase tracking-tight leading-tight line-clamp-1 mb-1.5">{selectedPatient.name}</h2>
                     
                     <div className="grid grid-cols-2 gap-x-1 gap-y-1">
                        <div>
                          <div className="text-[6.5px] text-gray-400 uppercase font-bold tracking-wider">Patient ID</div>
                          <div className="text-[10px] font-mono font-bold text-gray-900">{selectedPatient.patientId}</div>
                        </div>
                        <div>
                          <div className="text-[6.5px] text-gray-400 uppercase font-bold tracking-wider">Age / Sex</div>
                          <div className="text-[9px] font-bold text-gray-900">{selectedPatient.age}Y / {selectedPatient.gender?.charAt(0).toUpperCase()}</div>
                        </div>
                        <div className="col-span-2">
                           <div className="text-[6.5px] text-gray-400 uppercase font-bold tracking-wider">Phone</div>
                           <div className="text-[9px] font-bold text-gray-900">{selectedPatient.phone || '-'}</div>
                        </div>
                     </div>
                   </div>

                   <div className="absolute bottom-1.5 left-2 right-2 flex justify-between items-end">
                      <div className="bg-white">
                         <Barcode value={selectedPatient.patientId} height={16} width={1.3} displayValue={true} fontSize={9} margin={0} background="transparent" />
                      </div>
                      <div className="p-0.5 bg-white border border-gray-200 rounded shrink-0">
                         <QRCodeSVG value={getPatientQrValue(selectedPatient)} size={28} />
                      </div>
                   </div>
                </div>
              </div>` + content.substring(footerStart - 14); // Roughly retaining closing divs
}


fs.writeFileSync(file, content);
console.log('Success');
