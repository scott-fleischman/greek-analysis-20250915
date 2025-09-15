# Description

This repo contains analysis of Greek texts, starting with the Greek New Testament. The analyses build on one another to form a comprehensive data analysis set.

## Data Sets

The first data set is the texts broken down into clauses with references (like Luke 2:3) for each clause, and an extra label to distinguish multiple clauses in the same verse reference (such as Luke 2:3a) similar to how biblical.

The second data set is per word and gives a lemma form, creating a dictionary or lexicon of entries so that different forms of the same lemma are grouped together.

The third data set analyzes the structure of each clause, starting with categorizations that follow those of the latest cognitive linguistics research. Consider using Van Valin's Role and Reference Grammar for core structure.

Another analysis should include valency analyses for each verb, so we can see what prepositions, subordinate clauses and categories of nouns (reference phrases) are used with each verb.

The data sets final form should be in a machine-actionable format like JSON with appropriate metadata. The schema should be determined before starting work.

## Reports
Each data set should have a report on progress, with all work broken down into small enough chunks to be done by an automated agent, with checkboxes and a link to a thorough summary for each section after it is done. The summary section should include stats of the data in that section, as well as a detailed list of what was found in each section in a human readable format.
