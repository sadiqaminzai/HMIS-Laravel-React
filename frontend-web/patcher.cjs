const fs = require('fs');

const path = 'src/app/components/LabTestManagementNew.tsx';
let content = fs.readFileSync(path, 'utf8');
const oldString = fs.readFileSync('oldString.txt', 'utf8');

const newString = `              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative p-4">
                {/* Hospital Selection for Super Admin */}
                {userRole === 'super_admin' && (
                  <div className="relative">
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                      Hospital <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsHospitalDropdownOpen((prev) => !prev)}
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-900 dark:text-white flex items-center justify-between"
                    >
                      <span className="truncate text-left">
                        {formData.hospitalId ? hospitals.find(h => h.id === formData.hospitalId)?.name || 'Select Hospital' : 'Select Hospital'}
                      </span>
                      <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isHospitalDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 border border-gray-300 dark:border-gray-600 rounded p-1 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-700 space-y-1 shadow-lg">
                        <input
                          type="text"
                          value={hospitalSearchKeyword}
                          onChange={(e) => setHospitalSearchKeyword(e.target.value)}
                          placeholder="Search hospital..."
                          className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 mb-1"
                        />
                        {filteredHospitalsForDropdown.map(h => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, hospitalId: h.id, patientId: '', selectedTests: [], discountPercentage: '', doctorId: userRole === 'doctor' ? (currentUserId || '') : '' });
                              setIsHospitalDropdownOpen(false);
                              setHospitalSearchKeyword('');
                            }}
                            className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-900 dark:text-gray-100"
                          >
                            {h.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Patient Selection */}
                <div className="relative">
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Patient <span className="text-red-500">*</span></label>
                  <button
                    type="button"
                    onClick={() => setIsPatientDropdownOpen((prev) => !prev)}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-900 dark:text-white flex items-center justify-between"
                  >
                    <span className="truncate text-left">
                      {formData.patientId ? doctorScopedPatients.find(p => p.id === formData.patientId)?.name || 'Select Patient' : 'Select Patient'}
                    </span>
                    <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isPatientDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 border border-gray-300 dark:border-gray-600 rounded p-1 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-700 space-y-1 shadow-lg">
                      <input
                        type="text"
                        value={patientSearchKeyword}
                        onChange={(e) => setPatientSearchKeyword(e.target.value)}
                        placeholder="Search patient..."
                        className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 mb-1"
                      />
                      {filteredPatientsForDropdown.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, patientId: p.id });
                            setIsPatientDropdownOpen(false);
                            setPatientSearchKeyword('');
                          }}
                          className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-900 dark:text-gray-100"
                        >
                          {p.name} ({p.age}Y, {p.gender})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Doctor Selection */}
                {userRole !== 'doctor' ? (
                  <div className="relative">
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Doctor <span className="text-red-500">*</span></label>
                    <button
                      type="button"
                      onClick={() => setIsDoctorDropdownOpen((prev) => !prev)}
                      className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-900 dark:text-white flex items-center justify-between"
                    >
                      <span className="truncate text-left">
                        {formData.doctorId ? doctorsForForm.find(d => d.id === formData.doctorId)?.name || 'Select Doctor' : 'Select Doctor'}
                      </span>
                      <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isDoctorDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 border border-gray-300 dark:border-gray-600 rounded p-1 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-700 space-y-1 shadow-lg">
                        <input
                          type="text"
                          value={doctorSearchKeyword}
                          onChange={(e) => setDoctorSearchKeyword(e.target.value)}
                          placeholder="Search doctor..."
                          className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 mb-1"
                        />
                        {filteredDoctorsForDropdown.map(d => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, doctorId: d.id });
                              setIsDoctorDropdownOpen(false);
                              setDoctorSearchKeyword('');
                            }}
                            className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-900 dark:text-gray-100"
                          >
                            {d.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Doctor</label>
                    <input
                      type="text"
                      value={doctors.find((d) => String(d.id) === String(currentUserId))?.name || 'Doctor'}
                      readOnly
                      className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-700/60 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-200 text-xs"
                    />
                  </div>
                )}
                {/* Test Selection */}
                <div className="relative md:col-span-2">
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                    Select Tests <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsTestDropdownOpen((prev) => !prev)}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-900 dark:text-white flex items-center justify-between"
                  >
                    <span className="truncate text-left">
                      {formData.selectedTests.length === 0
                        ? 'Search and select tests'
                        : `${formData.selectedTests.length} test(s) selected`}
                    </span>
                    <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isTestDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 border border-gray-300 dark:border-gray-600 rounded p-2 max-h-56 overflow-y-auto bg-gray-50 dark:bg-gray-700 shadow-lg space-y-2">
                      <input
                        type="text"
                        value={testSearchKeyword}
                        onChange={(e) => setTestSearchKeyword(e.target.value)}
                        placeholder="Search tests by name, code, or type"
                        className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      {filteredTestsForDropdown.length === 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">No tests found</p>
                      ) : (
                        filteredTestsForDropdown.map((test) => {
                          const testId = String(test.id);
                          const selected = formData.selectedTests.includes(testId);
                          return (
                            <button
                              key={test.id}
                              type="button"
                              onClick={() => toggleTestSelection(testId)}
                              className={`w-full flex items-start gap-2 p-2 rounded text-left transition-colors ${
                                selected
                                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                  : 'hover:bg-gray-200 dark:hover:bg-gray-600 border border-transparent'
                              }`}
                            >
                              <span className="pt-0.5">
                                {selected ? (
                                  <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <div className="w-3.5 h-3.5 border border-gray-300 dark:border-gray-500 rounded-sm" />
                                )}
                              </span>
                              <div>
                                <p className="text-xs font-medium text-gray-900 dark:text-white">{test.testName || test.test_name}</p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Code: {test.testCode || test.test_code} | Price: {(Number(test.price || test.cost || 0)).toFixed(2)} AFN</p>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                
                {/* Instructions */}
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Instructions</label>
                  <input
                    type="text"
                    value={formData.instructions}
                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                    placeholder="e.g. Fasting for 12 hours"
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Priority</label>
                  <div className="flex items-center gap-3 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded flex-wrap">
                    <label className="flex items-center text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="radio"
                        name="priority"
                        value="normal"
                        checked={formData.priority === 'normal'}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 mr-1.5 mt-0.5"
                      />
                      Normal
                    </label>
                    <label className="flex items-center text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="radio"
                        name="priority"
                        value="urgent"
                        checked={formData.priority === 'urgent'}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 mr-1.5 mt-0.5"
                      />
                      Urgent
                    </label>
                    <label className="flex items-center text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="radio"
                        name="priority"
                        value="stat"
                        checked={formData.priority === 'stat'}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 mr-1.5 mt-0.5"
                      />
                      Stat
                    </label>
                  </div>
                </div>

                {/* Discount */}
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.discountPercentage}
                    onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
                    placeholder="0"
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                  {formData.discountPercentage && Number(formData.discountPercentage) > 0 && !hasActionPermission('lab_test_order_discount') && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">You need lab_test_order_discount permission to edit discount.</p>
                  )}
                </div>

                {/* Totals */}
                <div className="col-span-1 md:col-span-2 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30 p-2 mt-2">
                  <div className="flex justify-between text-xs text-gray-700 dark:text-gray-300">
                    <span>Subtotal</span>
                    <span>{selectedTestsSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-700 dark:text-gray-300 mt-1">
                    <span>Discount ({selectedDiscountPercent.toFixed(2)}%)</span>
                    <span>{selectedDiscountAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-gray-900 dark:text-white mt-1 pt-1 border-t border-gray-200 dark:border-gray-600">
                    <span>Payable Total</span>
                    <span>{selectedTestsPayableTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>`;

content = content.replace(oldString, newString);

if (content.indexOf(newString.trim().substring(0, 100)) !== -1) {
  fs.writeFileSync(path, content);
  console.log('PATCH APPLIED');
} else {
  console.log('FAILED TO PATCH');
}
