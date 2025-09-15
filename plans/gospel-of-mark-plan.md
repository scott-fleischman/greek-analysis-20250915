# Gospel of Mark Comprehensive Analysis Plan

## 1. Foundational Setup and Governance
- [ ] Audit the repository structure and confirm that the SBLGNT submodule is initialized and accessible, focusing on retrieving the Gospel of Mark text for downstream work.
- [ ] Define project-wide conventions (file naming, metadata keys, data validation rules) that all datasets and reports will follow to keep the analyses cohesive.
- [ ] Establish an automated agent workflow template (task definition, input/output expectations, validation steps) so each small task can be executed consistently.

## 2. Shared Data Schema Design
- [ ] Draft an initial machine-actionable JSON schema that can accommodate clause-level, word-level, structural, and valency data, along with metadata such as sources, processing timestamps, and validation status.
- [ ] Review the schema against sample Mark data to ensure it covers all required attributes (references, lemmas, structural tags, valency relations).
- [ ] Create schema documentation and lightweight tests that agents can use to validate JSON outputs before submission.

## 3. Clause-Level Dataset (Dataset 1)
- [ ] Extract the raw Greek text of Mark from SBLGNT and segment it by verse reference, retaining verse numbering metadata.
- [ ] Research and document clause segmentation guidelines (handling conjunctions, embedded clauses, ellipsis) tailored to Koine Greek stylistics.
- [ ] Implement automated clause segmentation according to the guidelines, producing draft clause boundaries with provisional identifiers (e.g., Mk 1:1a).
- [ ] Run a validation pass comparing automated splits against a human-reviewed sample; log discrepancies for follow-up correction tasks.
- [ ] Convert the vetted clause list into the shared JSON schema, including metadata such as segmentation rules version and reviewer approvals.
- [ ] Generate clause-level descriptive statistics (counts per chapter, average clause length, distribution of clause labels) for use in reporting.

## 4. Word-Level Lemma Dataset (Dataset 2)
- [ ] Tokenize each clause into words, linking each token back to its clause identifier and verse reference.
- [ ] Align each token with an appropriate lemma using an existing lexicon or morphological analyzer; document decision rules for ambiguous forms.
- [ ] Aggregate lemmas to create a dictionary entry for each unique lemma, noting frequency, part-of-speech, and morphological variants observed in Mark.
- [ ] Validate lemma assignments on a stratified sample with manual review notes for future improvements.
- [ ] Export the token-to-lemma mapping and lemma dictionary into the shared JSON format, ensuring cross-links to clause IDs and metadata.
- [ ] Compute lemma-level statistics (e.g., top lemmas, hapax legomena) for inclusion in the word dataset report.

## 5. Clause Structure Dataset (Dataset 3)
- [ ] Review Van Valin’s Role and Reference Grammar (RRG) resources and distill the structural categories relevant for clause annotation.
- [ ] Develop annotation guidelines mapping RRG concepts (macroroles, operators, peripherals) to fields in the shared schema.
- [ ] Create or adapt tooling to annotate each clause’s core structure, operator structure, and peripheral elements, storing intermediate annotations alongside confidence scores.
- [ ] Conduct quality control by comparing automated structure tags with expert annotations on selected passages; record issues and iterate on rules/models.
- [ ] Finalize structured annotations in JSON, linking to clause IDs and lemma data as needed for cross-referencing.
- [ ] Produce structural analysis statistics (distribution of clause types, frequency of particular operators/peripherals) for reporting.

## 6. Verb Valency Analysis
- [ ] Identify all verb lemmas in Mark and compile their occurrences with surrounding syntactic context (subjects, objects, complements, prepositions, subordinate clauses).
- [ ] Define valency annotation categories (argument types, optionality, adjunct classifications) consistent with the structural dataset and RRG framework.
- [ ] Implement automated extraction of valency frames per verb lemma, capturing observed argument structures and associated reference phrase categories.
- [ ] Validate a subset of valency frames via manual review, noting recurring issues (e.g., ambiguous complements, implicit arguments).
- [ ] Serialize valency findings into JSON, referencing verbs’ lemma entries and clause IDs for traceability.
- [ ] Summarize valency patterns (common frames, outliers, correlations with clause types) for inclusion in the valency report.

## 7. Integrated Reporting
- [ ] Draft report templates for each dataset featuring checklists, progress indicators, links to summaries, and placeholders for statistics and qualitative findings.
- [ ] Populate each dataset report once preliminary data is available, ensuring that every completed section includes human-readable summaries and references to the JSON outputs.
- [ ] Maintain a master progress tracker for the Gospel of Mark, aggregating dataset completion status and linking to individual reports.
- [ ] Schedule periodic synthesis reports highlighting cross-dataset insights (e.g., correlation between clause structures and verb valency patterns).

## 8. Quality Assurance and Maintenance
- [ ] Implement automated validation checks that run against all JSON outputs (schema validation, referential integrity, statistical sanity checks).
- [ ] Set up regression tests ensuring that updates to segmentation, lemma mapping, or structural annotations do not break previously validated data.
- [ ] Document a review-and-approval pipeline so agents can flag work for human verification where necessary (e.g., complex valency cases).
- [ ] Archive intermediate artifacts and decision logs for reproducibility before moving on to other New Testament books.
